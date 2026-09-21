import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, invoiceItems, invoices, type Invoice } from "@/db/schema";
import { calcTotals } from "@/lib/money";
import { maxInvoiceSequence, nextInvoiceNumber } from "@/lib/invoice";
import { startOfMonth } from "@/lib/quota";

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
    .innerJoin(clients, eq(invoices.clientId, clients.id))
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
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), gte(invoices.createdAt, startOfMonth())));
  return row?.n ?? 0;
}

export async function getInvoiceDetail(userId: string, invoiceId: string) {
  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
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

async function generateInvoiceNumber(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), like(invoices.number, `INV-${year}-%`)));
  const seq = maxInvoiceSequence(existing.map((r) => r.number), year) + 1;
  return nextInvoiceNumber(year, seq);
}

export async function createInvoice(userId: string, input: InvoiceInput) {
  const invoiceId = randomUUID();
  const number = await generateInvoiceNumber(userId);

  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: invoiceId,
      userId,
      clientId: input.clientId,
      number,
      status: input.status,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      taxBps: input.taxBps,
      notes: input.notes,
      token: randomBytes(24).toString("hex"),
    });
    await tx.insert(invoiceItems).values(
      input.items.map((item, position) => ({
        id: randomUUID(),
        invoiceId,
        position,
        ...item,
      })),
    );
  });

  return { id: invoiceId, number };
}

export async function updateInvoice(
  userId: string,
  invoiceId: string,
  input: InvoiceInput,
): Promise<boolean> {
  const owned = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .limit(1);
  if (owned.length === 0) return false;

  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        clientId: input.clientId,
        status: input.status,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        taxBps: input.taxBps,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    await tx.insert(invoiceItems).values(
      input.items.map((item, position) => ({
        id: randomUUID(),
        invoiceId,
        position,
        ...item,
      })),
    );
  });
  return true;
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
