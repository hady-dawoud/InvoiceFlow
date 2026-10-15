import type { Invoice } from "@/db/schema";
import { isOverdue } from "@/lib/invoice";

export function overviewByCurrency(
  invoices: (Pick<Invoice, "status" | "dueDate"> & { totalCents: number; currency: string })[],
) {
  const currencies = [...new Set(invoices.map((invoice) => invoice.currency))];
  return currencies.map((currency) => ({
    currency,
    ...invoiceOverview(invoices.filter((invoice) => invoice.currency === currency)),
  })).sort((left, right) => {
    const leftOwed = left.outstanding + left.overdue;
    const rightOwed = right.outstanding + right.overdue;
    if (rightOwed !== leftOwed) return rightOwed > leftOwed ? 1 : -1;
    return left.currency < right.currency ? -1 : left.currency > right.currency ? 1 : 0;
  });
}

export function invoiceOverview(invoices: (Pick<Invoice, "status" | "dueDate"> & { totalCents: number })[]) {
  const billed = invoices.filter((invoice) => invoice.status !== "draft")
    .reduce((sum, invoice) => sum + BigInt(invoice.totalCents), 0n);
  const paid = invoices.filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + BigInt(invoice.totalCents), 0n);
  const outstanding = invoices.filter((invoice) => invoice.status === "sent" && !isOverdue(invoice))
    .reduce((sum, invoice) => sum + BigInt(invoice.totalCents), 0n);
  const overdue = invoices.filter((invoice) => isOverdue(invoice))
    .reduce((sum, invoice) => sum + BigInt(invoice.totalCents), 0n);
  return { billed, paid, outstanding, overdue };
}
