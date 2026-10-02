import { setTimeout } from "node:timers/promises";
import { connectDatabase, db } from "./index";

export type WriteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isLocked(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "SQLITE_BUSY" || code === "SQLITE_LOCKED" ||
    ("cause" in error && isLocked(error.cause));
}

export async function writeTransaction<T>(work: (tx: WriteTransaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    // A failed native BEGIN can poison libsql's pool; isolate each write attempt.
    const connection = connectDatabase();
    try { return await connection.transaction(work); }
    catch (error) {
      if (!isLocked(error) || attempt === 6) throw error;
      await setTimeout(20 * 2 ** attempt);
    } finally { connection.$client.close(); }
  }
}
