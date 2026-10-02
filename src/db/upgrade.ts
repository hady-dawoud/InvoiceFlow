import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { invoices } from "./schema";
import { writeTransaction } from "./write-transaction";
import { initializeMonthlyUsage, initializeSequence } from "@/lib/data/invoice-counters";

// Additive, rerunnable: existing counters retain creation/deletion history.
export async function upgradeInvoiceCounters() {
  await writeTransaction(async (tx) => {
    const statements = readFileSync("migrations/0001-invoice-counters.sql", "utf8").split(";").filter((s) => s.trim());
    for (const statement of statements) await tx.run(sql.raw(statement));
    const rows = await tx.select().from(invoices);
    for (const row of rows) {
      await initializeMonthlyUsage(tx, row.userId, row.createdAt);
      const year = /^INV-(\d{4})-\d+$/.exec(row.number)?.[1];
      if (year) await initializeSequence(tx, row.userId, Number(year));
    }
  });
}

export async function runUpgrade() {
  try { await upgradeInvoiceCounters(); }
  finally { db.$client.close(); }
}
