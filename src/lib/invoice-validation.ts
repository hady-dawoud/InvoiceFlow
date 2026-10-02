import type { InvoiceInput } from "@/lib/data/invoices";
import { calcTotals, parseAmountToCents } from "@/lib/money";

type ParsedItems = { description: string; quantity: number; unitPriceCents: number }[];

export function parseQuantity(value: unknown): number | null {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseItems(raw: unknown): ParsedItems | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const items: ParsedItems = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) return null;
    const { description, quantity, price } = entry as Record<string, unknown>;
    if (typeof description !== "string" || description.trim().length === 0) return null;
    const qty = parseQuantity(quantity);
    if (qty === null) return null;
    const unitPriceCents = typeof price === "string" ? parseAmountToCents(price) : null;
    if (unitPriceCents === null) return null;
    items.push({ description: description.trim(), quantity: qty, unitPriceCents });
  }
  return items;
}

export function parseInvoiceInput(formData: FormData): InvoiceInput | string {
  const clientId = formData.get("clientId");
  const issueDate = formData.get("issueDate");
  const dueDate = formData.get("dueDate");
  const taxRate = formData.get("taxRate");
  const notes = formData.get("notes");
  const status = formData.get("status");

  if (typeof clientId !== "string" || clientId.length === 0) return "Choose a client.";
  if (!isCalendarDate(issueDate)) return "Invalid issue date.";
  if (!isCalendarDate(dueDate)) return "Invalid due date.";

  let taxBps = 0;
  if (typeof taxRate === "string" && taxRate.trim().length > 0) {
    const rate = parseAmountToCents(taxRate);
    if (rate === null || rate > 5000) return "Tax rate must be between 0 and 50 with at most two decimals.";
    taxBps = rate;
  }

  if (status !== "draft" && status !== "sent" && status !== "paid") {
    return "Invalid status.";
  }
  const items = parseItems(formData.get("itemsJson"));
  if (!items) return "Add at least one line item with a valid price.";
  try { calcTotals(items, taxBps); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return error.message;
  }

  return {
    clientId,
    status,
    issueDate,
    dueDate,
    taxBps,
    notes: typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null,
    items,
  };
}
