import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

await vi.hoisted(async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "invoiceflow-tests-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
});

import { deleteClient, listClientsWithStats } from "./clients";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoiceItems, invoices, invoiceMonthlyUsage, invoiceSequences, user } from "@/db/schema";
import { upgradeBusinessIdentity, upgradeInvoiceCounters } from "@/db/upgrade";
import { updateBusinessProfile } from "./business-profile";
import { createTestSchema, seedOwners } from "@/test/database";
import { countInvoicesThisMonth, createInvoice, deleteInvoice, getInvoiceDetail, listInvoiceSummaries, setInvoiceStatus, updateInvoice, type InvoiceInput } from "./invoices";

const input: InvoiceInput = {
  clientId: "owner-client", status: "draft", issueDate: "2026-10-01", dueDate: "2026-10-31",
  taxBps: 0, notes: null, items: [{ description: "Work", quantity: 1, unitPriceCents: 100 }],
};

beforeAll(createTestSchema);
beforeEach(async () => {
  await db.delete(invoiceItems);
  await db.delete(invoices);
  await db.delete(user);
  await seedOwners();
});
afterAll(() => db.$client.close());

describe("invoice persistence", () => {
  it("rejects a foreign client on creation", async () => {
    await expect(createInvoice("owner", { ...input, clientId: "other-client" })).rejects.toThrow("Unknown client.");
    expect(await countInvoicesThisMonth("owner")).toBe(0);
  });
  it("rejects a foreign client on edit without replacing existing items", async () => {
    const created = await createInvoice("owner", input);
    await expect(updateInvoice("owner", created.id, { ...input, clientId: "other-client", items: [{ ...input.items[0], description: "Changed" }] })).rejects.toThrow("Unknown client.");
    const detail = await getInvoiceDetail("owner", created.id);
    expect(detail?.client.email).toBe("owner-private@example.com");
    expect(detail?.items[0].description).toBe("Work");
  });
  it("does not allow another account to edit or read an invoice", async () => {
    const created = await createInvoice("owner", input);
    expect(await updateInvoice("other", created.id, { ...input, clientId: "other-client" })).toBe(false);
    expect(await getInvoiceDetail("other", created.id)).toBeNull();
  });
  it("deletion preserves monthly usage and invoice numbers", async () => {
    const created = await createInvoice("owner", input);
    await deleteInvoice("owner", created.id);
    expect(await countInvoicesThisMonth("owner")).toBe(1);
    expect((await createInvoice("owner", input)).number).toMatch(/-0002$/);
  });
  it("treats an ended wallet term as the free plan", async () => {
    await db.update(user).set({ isPro: true, proUntil: new Date("2020-01-01T00:00:00.000Z") }).where(eq(user.id, "owner"));
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => createInvoice("owner", input)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  });
  it("enforces the free quota during concurrent creation", async () => {
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => createInvoice("owner", input)));
    expect(results.filter((r) => r.status === "fulfilled"), results.filter((r) => r.status === "rejected").map((r) => String(r.reason)).join(", ")).toHaveLength(3);
    const errors = results.filter((r) => r.status === "rejected").map((r) => String(r.reason));
    expect(errors.every((error) => error.includes("quota"))).toBe(true);
    expect(await countInvoicesThisMonth("owner")).toBe(3);
  });
  it("rolls back counters and invoice when item insertion fails", async () => {
    await db.$client.executeMultiple("CREATE TRIGGER fail_items BEFORE INSERT ON invoice_items BEGIN SELECT RAISE(ABORT, 'test item failure'); END;");
    try { await expect(createInvoice("owner", input)).rejects.toThrow(); }
    finally { await db.$client.execute("DROP TRIGGER fail_items"); }
    expect(await countInvoicesThisMonth("owner")).toBe(0);
    expect((await createInvoice("owner", input)).number).toMatch(/-0001$/);
  });
  it("refuses to create an invoice that is already paid", async () => {
    await expect(createInvoice("owner", { ...input, status: "paid" })).rejects.toThrow("Invalid status.");
    expect(await countInvoicesThisMonth("owner")).toBe(0);
  });
  it("allows only the manual status transitions", async () => {
    const created = await createInvoice("owner", input);
    await expect(setInvoiceStatus("owner", created.id, "paid")).rejects.toThrow("Invalid status.");
    expect((await getInvoiceDetail("owner", created.id))?.invoice.status).toBe("draft");
    expect(await setInvoiceStatus("owner", created.id, "sent")).toBe(true);
    expect(await setInvoiceStatus("owner", created.id, "paid")).toBe(true);
    await expect(setInvoiceStatus("owner", created.id, "draft")).rejects.toThrow("Invalid status.");
    expect((await getInvoiceDetail("owner", created.id))?.invoice.status).toBe("paid");
    await expect(updateInvoice("owner", created.id, { ...input, status: "draft" })).rejects.toThrow("Invalid status.");
    expect(await updateInvoice("owner", created.id, { ...input, status: "paid", notes: "Kept" })).toBe(true);
    expect((await getInvoiceDetail("owner", created.id))?.invoice.notes).toBe("Kept");
  });
});

it("persists document locale on create and update", async () => {
  const created = await createInvoice("owner", { ...input, documentLocale: "ar" });
  expect((await getInvoiceDetail("owner", created.id))?.invoice.documentLocale).toBe("ar");
  await updateInvoice("owner", created.id, { ...input, documentLocale: "en" });
  expect((await getInvoiceDetail("owner", created.id))?.invoice.documentLocale).toBe("en");
});

it("snapshots the account currency onto a new invoice", async () => {
  await db.update(user).set({ currency: "eur" }).where(eq(user.id, "owner"));
  const created = await createInvoice("owner", input);
  expect((await getInvoiceDetail("owner", created.id))?.invoice.currency).toBe("eur");
  await db.update(user).set({ currency: "gbp" }).where(eq(user.id, "owner"));
  expect((await getInvoiceDetail("owner", created.id))?.invoice.currency).toBe("eur");
  const next = await createInvoice("owner", input);
  expect((await getInvoiceDetail("owner", next.id))?.invoice.currency).toBe("gbp");
});

it("saves payment details for that account only", async () => {
  expect(await updateBusinessProfile("owner", {
    businessName: "Ada Studio",
    currency: "sar",
    taxId: "300",
    paymentInstructions: "Transfer to IBAN SA00",
  })).toBe(true);
  const [owner] = await db.select().from(user).where(eq(user.id, "owner"));
  const [other] = await db.select().from(user).where(eq(user.id, "other"));
  expect(owner).toMatchObject({ businessName: "Ada Studio", currency: "sar", taxId: "300", paymentInstructions: "Transfer to IBAN SA00" });
  expect(other.businessName).toBeNull();
  expect(other.taxId).toBeNull();
});

it("upgrade copies the account currency onto invoices created before that column", async () => {
  await db.update(user).set({ currency: "eur" }).where(eq(user.id, "owner"));
  await db.$client.executeMultiple(`
    PRAGMA foreign_keys = OFF;
    ALTER TABLE user DROP COLUMN tax_id;
    ALTER TABLE user DROP COLUMN payment_instructions;
    DROP TABLE invoices;
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      tax_bps INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      document_locale TEXT NOT NULL DEFAULT 'en',
      token TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    PRAGMA foreign_keys = ON;
  `);
  const now = Math.floor(Date.now() / 1000);
  await db.$client.execute({
    sql: `INSERT INTO invoices (id, user_id, client_id, number, status, issue_date, due_date, token, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?)`,
    args: ["legacy-currency", "owner", "owner-client", "INV-2026-0101", input.issueDate, input.dueDate, "legacy-currency-token", now, now],
  });
  try {
    await upgradeBusinessIdentity();
    expect((await getInvoiceDetail("owner", "legacy-currency"))?.invoice.currency).toBe("eur");
    await upgradeBusinessIdentity();
    expect((await getInvoiceDetail("owner", "legacy-currency"))?.invoice.currency).toBe("eur");
  } finally {
    await db.$client.executeMultiple(`
      CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_number_idx ON invoices (user_id, number);
      CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices (user_id);
      CREATE INDEX IF NOT EXISTS invoices_user_issue_idx ON invoices (user_id, issue_date);
      CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices (client_id);
    `);
  }
});

it("stores the caller locale when documentLocale is omitted on create", async () => {
  const created = await createInvoice("owner", input, "ar");
  expect((await getInvoiceDetail("owner", created.id))?.invoice.documentLocale).toBe("ar");
});

it("upgrade backfills document_locale to en on rows inserted without the column", async () => {
  await db.$client.executeMultiple(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE invoices;
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      tax_bps INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      token TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    PRAGMA foreign_keys = ON;
  `);
  const now = Math.floor(Date.now() / 1000);
  await db.$client.execute({
    sql: `INSERT INTO invoices (id, user_id, client_id, number, status, issue_date, due_date, token, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    args: ["legacy-locale", "owner", "owner-client", "INV-2026-0100", input.issueDate, input.dueDate, "legacy-locale-token", now, now],
  });
  try {
    await upgradeInvoiceCounters();
    expect((await getInvoiceDetail("owner", "legacy-locale"))?.invoice.documentLocale).toBe("en");
    await upgradeInvoiceCounters();
    expect((await getInvoiceDetail("owner", "legacy-locale"))?.invoice.documentLocale).toBe("en");
  } finally {
    await db.$client.executeMultiple(`
      CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_number_idx ON invoices (user_id, number);
      CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices (user_id);
      CREATE INDEX IF NOT EXISTS invoices_user_issue_idx ON invoices (user_id, issue_date);
      CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices (client_id);
    `);
  }
});

it("additive upgrade initializes surviving history and preserves counters on rerun", async () => {
  const year = new Date().getFullYear();
  await db.insert(invoices).values({ id: "legacy", userId: "owner", clientId: "owner-client", number: `INV-${year}-0042`, status: "draft", issueDate: input.issueDate, dueDate: input.dueDate, token: "legacy-token" });
  await db.$client.executeMultiple("DROP TABLE invoice_monthly_usage; DROP TABLE invoice_sequences;");
  await upgradeInvoiceCounters();
  expect(await countInvoicesThisMonth("owner")).toBe(1);
  await deleteInvoice("owner", "legacy");
  await upgradeInvoiceCounters();
  expect(await countInvoicesThisMonth("owner")).toBe(1);
  expect((await createInvoice("owner", input)).number).toMatch(/-0043$/);
  expect(await db.select().from(invoiceMonthlyUsage)).toHaveLength(1);
  expect(await db.select().from(invoiceSequences)).toHaveLength(1);
});

it("an exhausted write lock fails without consuming quota or numbering", async () => {
  const connection = createClient({ url: process.env.DATABASE_URL! });
  const lock = await connection.transaction("write");
  try { await expect(createInvoice("owner", input)).rejects.toThrow(); }
  finally { await lock.rollback(); connection.close(); }
  expect(await countInvoicesThisMonth("owner")).toBe(0);
  expect((await createInvoice("owner", input)).number).toMatch(/-0001$/);
});

it("does not reveal another account's client through deletion", async () => {
  await createInvoice("other", { ...input, clientId: "other-client" });
  expect(await deleteClient("owner", "other-client")).toBe("not-found");
  expect(await deleteClient("other", "other-client")).toBe("has-invoices");
});

it("indexes billing lookups and invoice lists", async () => {
  const result = await db.$client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('user_stripe_customer_id_idx', 'invoices_user_issue_idx')",
  );
  expect(result.rows).toHaveLength(2);
});

it("legacy cross-account assignments are hidden in joined reads", async () => {
  await db.insert(invoices).values({ id: "poisoned", userId: "owner", clientId: "other-client", number: "INV-2026-9999", issueDate: input.issueDate, dueDate: input.dueDate, token: "poisoned-token" });
  expect(await getInvoiceDetail("owner", "poisoned")).toBeNull();
  expect(await listInvoiceSummaries("owner")).toEqual([]);
  expect((await listClientsWithStats("other"))[0].invoiceCount).toBe(0);
});
