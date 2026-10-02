import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { expect, it } from "vitest";
import * as schema from "./schema";

const repository = resolve(import.meta.dirname, "../..");

async function commandFixture() {
  const directory = mkdtempSync(join(tmpdir(), "invoiceflow-commands-"));
  const url = `file:${join(directory, "configured.db").replaceAll("\\", "/")}`;
  const client = createClient({ url });
  const statements = await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema),
  );
  await client.executeMultiple(statements.join("\n"));
  writeFileSync(join(directory, ".env"), `DATABASE_URL=${url}\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nAPP_URL=http://localhost:3000\n`);
  mkdirSync(join(directory, "migrations"));
  copyFileSync(join(repository, "migrations/0001-invoice-counters.sql"), join(directory, "migrations/0001-invoice-counters.sql"));
  return { directory, url, client, db: drizzle(client, { schema }) };
}

function runCommand(directory: string, script: string, overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
  for (const name of ["DATABASE_URL", "DATABASE_AUTH_TOKEN", "BETTER_AUTH_SECRET", "APP_URL", "__NEXT_PROCESSED_ENV"]) delete env[name];
  return spawnSync(process.execPath, [join(repository, "node_modules/tsx/dist/cli.mjs"),
    "--tsconfig", join(repository, "tsconfig.json"), join(repository, script)], {
    cwd: directory, env: { ...env, ...overrides }, encoding: "utf8", windowsHide: true, timeout: 15000,
  });
}

it.each(["env file", "shell override"])("upgrade targets the database from %s", async (source) => {
  const configured = await commandFixture();
  const target = source === "shell override" ? await commandFixture() : configured;
  try {
    const now = new Date();
    await target.db.insert(schema.user).values({ id: "owner", name: "Owner", email: "owner@example.com", createdAt: now, updatedAt: now });
    await target.db.insert(schema.clients).values({ id: "client", userId: "owner", name: "Client" });
    await target.db.insert(schema.invoices).values({ id: "invoice", userId: "owner", clientId: "client", token: "token", number: "INV-2026-0042", issueDate: "2026-01-01", dueDate: "2026-01-31" });
    await target.client.executeMultiple("DROP TABLE invoice_monthly_usage; DROP TABLE invoice_sequences;");
    const command = runCommand(configured.directory, "scripts/upgrade-db.ts", source === "shell override" ? { DATABASE_URL: target.url } : {});
    expect(command.status, command.stderr).toBe(0);
    expect((await target.db.select().from(schema.invoiceMonthlyUsage))[0]?.count).toBe(1);
    expect((await target.db.select().from(schema.invoiceSequences))[0]?.sequence).toBe(42);
    if (source === "shell override") expect(await configured.db.select().from(schema.invoiceMonthlyUsage)).toEqual([]);
  } finally {
    target.client.close();
    if (target !== configured) configured.client.close();
  }
}, 20000);

it("seed loads the configured database and authentication secret", async () => {
  const fixture = await commandFixture();
  try {
    const command = runCommand(fixture.directory, "scripts/seed-db.ts");
    expect(command.status, command.stderr).toBe(0);
    expect(command.stderr).not.toContain("BETTER_AUTH_SECRET");
    expect((await fixture.db.select().from(schema.user))[0]?.email).toBe("demo@invoiceflow.dev");
    expect(await fixture.db.select().from(schema.invoices)).toHaveLength(5);
  } finally { fixture.client.close(); }
}, 20000);
