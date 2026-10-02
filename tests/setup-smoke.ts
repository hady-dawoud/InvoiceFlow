import { createTestSchema } from "../src/test/database";
import { db } from "../src/db";

createTestSchema().then(() => db.$client.close()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
