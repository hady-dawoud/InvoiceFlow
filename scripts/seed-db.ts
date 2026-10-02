import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import("../src/db/seed").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
