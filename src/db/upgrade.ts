import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { invoices } from "./schema";
import { writeTransaction, type WriteTransaction } from "./write-transaction";
import { initializeMonthlyUsage, initializeSequence } from "@/lib/data/invoice-counters";

async function applySqlFile(tx: WriteTransaction, path: string) {
  const statements = readFileSync(path, "utf8").split(";").filter((s) => s.trim());
  for (const statement of statements) await tx.run(sql.raw(statement));
}

// Additive, rerunnable: skips ALTER when pragma_table_info already lists the column.
export async function upgradeDocumentLocale() {
  await writeTransaction(async (tx) => {
    const columns = await tx.all(sql.raw("SELECT name FROM pragma_table_info('invoices')")) as { name: string }[];
    if (columns.some((column) => column.name === "document_locale")) return;
    await applySqlFile(tx, "migrations/0002-document-locale.sql");
  });
}

async function columnNames(tx: WriteTransaction, table: "user" | "invoices") {
  const columns = await tx.all(sql.raw(`SELECT name FROM pragma_table_info('${table}')`)) as { name: string }[];
  return new Set(columns.map((column) => column.name));
}

// Additive, rerunnable. Invoice currency is copied once, when the column is added.
export async function upgradeBusinessIdentity() {
  await writeTransaction(async (tx) => {
    const userColumns = await columnNames(tx, "user");
    if (!userColumns.has("tax_id")) await tx.run(sql.raw("ALTER TABLE user ADD COLUMN tax_id TEXT"));
    if (!userColumns.has("payment_instructions")) {
      await tx.run(sql.raw("ALTER TABLE user ADD COLUMN payment_instructions TEXT"));
    }
    const invoiceColumns = await columnNames(tx, "invoices");
    if (invoiceColumns.has("currency")) return;
    await tx.run(sql.raw("ALTER TABLE invoices ADD COLUMN currency TEXT NOT NULL DEFAULT 'usd'"));
    await tx.run(sql.raw(
      "UPDATE invoices SET currency = COALESCE((SELECT currency FROM user WHERE user.id = invoices.user_id), 'usd')",
    ));
  });
}

// Additive, rerunnable: existing counters retain creation/deletion history.
export async function upgradeInvoiceCounters() {
  await upgradeDocumentLocale();
  await upgradeBusinessIdentity();
  await writeTransaction(async (tx) => {
    await applySqlFile(tx, "migrations/0001-invoice-counters.sql");
    const rows = await tx.select().from(invoices);
    for (const row of rows) {
      await initializeMonthlyUsage(tx, row.userId, row.createdAt);
      const year = /^INV-(\d{4})-\d+$/.exec(row.number)?.[1];
      if (year) await initializeSequence(tx, row.userId, Number(year));
    }
  });
}

export async function upgradeWalletBilling() {
  await writeTransaction(async (tx) => {
    const columns = await columnNames(tx, "user");
    if (!columns.has("pro_until")) await tx.run(sql.raw("ALTER TABLE user ADD COLUMN pro_until INTEGER"));
    await tx.run(sql.raw(`CREATE TABLE IF NOT EXISTS wallet_payment (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      amount_egp INTEGER NOT NULL,
      months INTEGER NOT NULL,
      confirmation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      activated_at INTEGER
    )`));
    await tx.run(sql.raw("CREATE INDEX IF NOT EXISTS wallet_payment_user_idx ON wallet_payment (user_id)"));
    await tx.run(sql.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS wallet_payment_one_pending ON wallet_payment (user_id) WHERE status = 'pending'",
    ));
  });
}

export async function runUpgrade() {
  try {
    await upgradeInvoiceCounters();
    await upgradeWalletBilling();
  } finally { db.$client.close(); }
}
