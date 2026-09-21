import type { Invoice } from "@/db/schema";

export type InvoiceStatus = "draft" | "sent" | "paid";

/** Today as an ISO calendar date (server-local). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Overdue is derived, never stored: a sent invoice past its due date. */
export function isOverdue(invoice: Pick<Invoice, "status" | "dueDate">, today = todayIso()): boolean {
  return invoice.status === "sent" && invoice.dueDate < today;
}

export function nextInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Highest existing sequence for numbers like INV-2026-0042 (suffix may exceed 4 digits). */
export function maxInvoiceSequence(numbers: string[], year: number): number {
  const prefix = `INV-${year}-`;
  return numbers.reduce((max, number) => {
    if (!number.startsWith(prefix)) return max;
    const seq = parseInt(number.slice(prefix.length), 10);
    return Number.isNaN(seq) ? max : Math.max(max, seq);
  }, 0);
}

export const STATUS_META: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600" },
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700" },
};

export const STATUS_ORDER: InvoiceStatus[] = ["draft", "sent", "paid"];

/** Which status transitions the owner may apply manually. */
export function allowedTransitions(status: InvoiceStatus): InvoiceStatus[] {
  switch (status) {
    case "draft":
      return ["sent"];
    case "sent":
      return ["paid", "draft"];
    case "paid":
      return ["sent"];
  }
}
