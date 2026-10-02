import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { db } from "@/db";
import * as schema from "@/db/schema";

export async function createTestSchema() {
  const empty = await generateSQLiteDrizzleJson({});
  const current = await generateSQLiteDrizzleJson(schema);
  const statements = await generateSQLiteMigration(empty, current);
  await db.$client.executeMultiple(statements.join("\n"));
}

export async function seedOwners() {
  const now = new Date();
  await db.insert(schema.user).values(["owner", "other"].map((id) => ({
    id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now,
  })));
  await db.insert(schema.clients).values(["owner", "other"].map((id) => ({
    id: `${id}-client`, userId: id, name: id, email: `${id}-private@example.com`,
  })));
}
