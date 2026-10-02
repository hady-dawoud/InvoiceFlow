import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function connectDatabase() {
  return drizzle(createClient({
    url: process.env.DATABASE_URL ?? "file:./app.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }), { schema });
}

export const db = connectDatabase();
