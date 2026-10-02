import type { Invoice } from "@/db/schema";
import { isOverdue } from "@/lib/invoice";

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
