import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, invoiceItems, invoices, invoiceMonthlyUsage, user, type Invoice } from "@/db/schema";
import { calcTotals } from "@/lib/money";
import { consumeInvoiceCounters, InvoiceWriteError, monthKey } from "./invoice-counters";
import { writeTransaction, type WriteTransaction } from "@/db/write-transaction";
import { startOfMonth } from "@/lib/quota";
import { recordProductEvent } from "@/lib/analytics";

/** One invoice joined with its client and pre-computed item sum. */
export type InvoiceSummary = Invoice & {
  clientName: string;
  itemSumCents: number;
  totalCents: number;
};

export async function listInvoiceSummaries(userId: string): Promise<InvoiceSummary[]> {
  const rows = await db
    .select({ invoice: invoices, clientName: clients.name })
    .from(invoices)
    .innerJoin(clients, and(eq(invoices.clientId, clients.id), eq(invoices.userId, clients.userId)))
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt));

  const sums = await db
    .select({
      invoiceId: invoiceItems.invoiceId,
      itemSumCents: sql<number>`COALESCE(SUM(${invoiceItems.quantity} * ${invoiceItems.unitPriceCents}), 0)`.mapWith(
        Number,
      ),
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(eq(invoices.userId, userId))
    .groupBy(invoiceItems.invoiceId);

  const sumById = new Map(sums.map((s) => [s.invoiceId, s.itemSumCents]));

  return rows.map((row) => {
    const itemSumCents = sumById.get(row.invoice.id) ?? 0;
    const { totalCents } = calcTotals(
      [{ quantity: 1, unitPriceCents: itemSumCents }],
      row.invoice.taxBps,
    );
    return {
      ...row.invoice,
      clientName: row.clientName,
      itemSumCents,
      totalCents,
    };
  });
}

export async function countInvoicesThisMonth(userId: string): Promise<number> {
  const [usage] = await db.select().from(invoiceMonthlyUsage)
    .where(and(eq(invoiceMonthlyUsage.userId, userId), eq(invoiceMonthlyUsage.month, monthKey())));
  if (usage) return usage.count;
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [row] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(invoices)
    .where(and(eq(invoices.userId, userId), gte(invoices.createdAt, startOfMonth(now)), lt(invoices.createdAt, end)));
  return row.n;
}

export async function getInvoiceDetail(userId: string, invoiceId: string) {
  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, and(eq(invoices.clientId, clients.id), eq(invoices.userId, clients.userId)))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(invoiceItems.position);

  return { ...row, items };
}

export type InvoiceInput = {
  clientId: string;
  status: "draft" | "sent" | "paid";
  issueDate: string;
  dueDate: string;
  taxBps: number;
  notes: string | null;
  items: { description: string; quantity: number; unitPriceCents: number }[];
};

async function requireOwnedClient(tx: WriteTransaction, userId: string, clientId: string) {
  const [client] = await tx.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId))).limit(1);
  if (!client) throw new InvoiceWriteError("Unknown client.");
}

async function insertItems(tx: WriteTransaction, invoiceId: string, items: InvoiceInput["items"]) {
  await tx.insert(invoiceItems).values(items.map((item, position) => ({
    id: randomUUID(), invoiceId, position, ...item,
  })));
}

async function insertInvoice(userId: string, input: InvoiceInput) {
  return writeTransaction(async (tx) => {
    await requireOwnedClient(tx, userId, input.clientId);
    const [owner] = await tx.select({ id: user.id, isPro: user.isPro }).from(user).where(eq(user.id, userId));
    if (!owner) throw new InvoiceWriteError("Account not found.");
    const number = await consumeInvoiceCounters(tx, owner);
    const invoiceId = randomUUID();
    const { items, ...fields } = input;
    await tx.insert(invoices).values({ id: invoiceId, userId, number, token: randomBytes(24).toString("hex"), ...fields });
    await insertItems(tx, invoiceId, items);
    return { id: invoiceId, number };
  });
}

export async function createInvoice(userId: string, input: InvoiceInput) {
  calcTotals(input.items, input.taxBps);
  try {
    const created = await insertInvoice(userId, input);
    await recordProductEvent("invoice_created", userId);
    return created;
  } catch (error) {
    if (error instanceof InvoiceWriteError && error.message === "quota") {
      await recordProductEvent("upgrade_wall", userId);
    }
    throw error;
  }
}

export async function updateInvoice(userId: string, invoiceId: string, input: InvoiceInput): Promise<boolean> {
  calcTotals(input.items, input.taxBps);
  return writeTransaction(async (tx) => {
    const owned = and(eq(invoices.id, invoiceId), eq(invoices.userId, userId));
    const [invoice] = await tx.select({ id: invoices.id }).from(invoices).where(owned);
    if (!invoice) return false;
    await requireOwnedClient(tx, userId, input.clientId);
    const { items, ...fields } = input;
    await tx.update(invoices).set({ ...fields, updatedAt: new Date() }).where(owned);
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    await insertItems(tx, invoiceId, items);
    return true;
  });
}

export async function setInvoiceStatus(
  userId: string,
  invoiceId: string,
  status: Invoice["status"],
): Promise<boolean> {
  const result = await db
    .update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)));
  return result.rowsAffected > 0;
}

export async function deleteInvoice(userId: string, invoiceId: string): Promise<boolean> {
  const result = await db
    .delete(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)));
  return result.rowsAffected > 0;
}
