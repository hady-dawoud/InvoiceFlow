import { and, eq, gte, lt, sql } from "drizzle-orm";
import { invoiceMonthlyUsage, invoices, invoiceSequences } from "@/db/schema";
import type { WriteTransaction } from "@/db/write-transaction";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { maxInvoiceSequence, nextInvoiceNumber } from "@/lib/invoice";

export function monthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function initializeMonthlyUsage(tx: WriteTransaction, userId: string, now: Date) {
  const [existing] = await tx.select().from(invoiceMonthlyUsage).where(and(eq(invoiceMonthlyUsage.userId, userId), eq(invoiceMonthlyUsage.month, monthKey(now))));
  if (existing) return;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [row] = await tx.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(invoices)
    .where(and(eq(invoices.userId, userId), gte(invoices.createdAt, start), lt(invoices.createdAt, end)));
  await tx.insert(invoiceMonthlyUsage).values({ userId, month: monthKey(now), count: row.count }).onConflictDoNothing();
}

export async function initializeSequence(tx: WriteTransaction, userId: string, year: number) {
  const [existing] = await tx.select().from(invoiceSequences).where(and(eq(invoiceSequences.userId, userId), eq(invoiceSequences.year, year)));
  if (existing) return;
  const rows = await tx.select({ number: invoices.number }).from(invoices).where(eq(invoices.userId, userId));
  const sequence = maxInvoiceSequence(rows.map((row) => row.number), year);
  if (!Number.isSafeInteger(sequence)) throw new RangeError("Invoice sequence is too large.");
  await tx.insert(invoiceSequences).values({ userId, year, sequence }).onConflictDoNothing();
}

export async function consumeInvoiceCounters(tx: WriteTransaction, owner: { id: string; isPro: boolean }) {
  const now = new Date();
  const year = now.getFullYear();
  await initializeMonthlyUsage(tx, owner.id, now);
  await initializeSequence(tx, owner.id, year);
  const [usage] = await tx.update(invoiceMonthlyUsage).set({ count: sql`${invoiceMonthlyUsage.count} + 1` })
    .where(and(eq(invoiceMonthlyUsage.userId, owner.id), eq(invoiceMonthlyUsage.month, monthKey(now)),
      owner.isPro ? undefined : lt(invoiceMonthlyUsage.count, FREE_MONTHLY_LIMIT))).returning();
  if (!usage) throw new InvoiceWriteError("quota");
  const [sequence] = await tx.update(invoiceSequences).set({ sequence: sql`${invoiceSequences.sequence} + 1` })
    .where(and(eq(invoiceSequences.userId, owner.id), eq(invoiceSequences.year, year))).returning();
  if (!Number.isSafeInteger(sequence.sequence)) throw new RangeError("Invoice sequence is too large.");
  return nextInvoiceNumber(year, sequence.sequence);
}

export class InvoiceWriteError extends Error {}
