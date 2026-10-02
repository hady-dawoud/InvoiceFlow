import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";

async function availablePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

export async function startLocalServer() {
  const directory = mkdtempSync(join(tmpdir(), "invoiceflow-smoke-"));
  const port = await availablePort();
  const url = `http://localhost:${port}`;
  const env = { ...process.env, DATABASE_URL: `file:${join(directory, "smoke.db").replaceAll("\\", "/")}`,
    DATABASE_AUTH_TOKEN: "", BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), APP_URL: url,
    STRIPE_SECRET_KEY: "", STRIPE_PRICE_ID: "", STRIPE_WEBHOOK_SECRET: "" };
  for (const script of ["tests/setup-smoke.ts", "scripts/seed-db.ts"]) {
    const setup = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", script], { env, encoding: "utf8", windowsHide: true });
    if (setup.status !== 0) throw new Error(`Isolated setup failed: ${setup.stderr || setup.stdout}`);
  }
  const log = createWriteStream(join(directory, "server.log"));
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  const stop = async () => {
    if (server.exitCode === null) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await exited;
    }
    log.end();
  };
  try {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(`Server exited: see ${join(directory, "server.log")}`);
      try { if ((await fetch(url)).ok) return { url, stop }; }
      catch (error) { if (!(error instanceof TypeError)) throw error; }
      await setTimeout(100);
    }
    throw new Error(`Server readiness timeout: see ${join(directory, "server.log")}`);
  } catch (error) { await stop(); throw error; }
}
