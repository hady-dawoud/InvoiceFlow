import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import("../src/db/upgrade").then(({ runUpgrade }) => runUpgrade()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
