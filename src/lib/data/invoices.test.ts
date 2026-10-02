import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

await vi.hoisted(async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "invoiceflow-tests-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
});

import { listClientsWithStats } from "./clients";
import { createClient } from "@libsql/client";
import { db } from "@/db";
import { invoiceItems, invoices, invoiceMonthlyUsage, invoiceSequences, user } from "@/db/schema";
import { upgradeInvoiceCounters } from "@/db/upgrade";
import { createTestSchema, seedOwners } from "@/test/database";
import { countInvoicesThisMonth, createInvoice, deleteInvoice, getInvoiceDetail, listInvoiceSummaries, updateInvoice, type InvoiceInput } from "./invoices";

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

it("legacy cross-account assignments are hidden in joined reads", async () => {
  await db.insert(invoices).values({ id: "poisoned", userId: "owner", clientId: "other-client", number: "INV-2026-9999", issueDate: input.issueDate, dueDate: input.dueDate, token: "poisoned-token" });
  expect(await getInvoiceDetail("owner", "poisoned")).toBeNull();
  expect(await listInvoiceSummaries("owner")).toEqual([]);
  expect((await listClientsWithStats("other"))[0].invoiceCount).toBe(0);
});
