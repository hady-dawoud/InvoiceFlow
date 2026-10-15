import type { InvoiceInput } from "@/lib/data/invoices";
import { calcTotals, latinDigits, parseAmountToCents } from "@/lib/money";

const MAX_ITEMS_JSON_CHARS = 100_000;
const MAX_LINE_ITEMS = 40;
const MAX_DESCRIPTION_CHARS = 400;
const MAX_QUANTITY = 1_000_000;
const MAX_NOTES_CHARS = 2_000;
const LINE_ITEM_ERROR = "invoice.lineItemRequired";

// `calcTotals` throws defensively on inputs that upstream validation should
// have already rejected. Map its messages to catalog keys too, so a message
// never reaches the UI as a raw English sentence.
const CALC_TOTALS_ERROR_KEYS: Record<string, string> = {
  "Invalid tax rate.": "invoice.invalidTaxRate",
  "Invalid line item.": "invoice.invalidLineItem",
  "Invoice total is too large.": "invoice.totalTooLarge",
};

type ParsedItems = { description: string; quantity: number; unitPriceCents: number }[];

export function parseQuantity(value: unknown): number | null {
  const normalized = typeof value === "string" ? latinDigits(value).trim() : value;
  if (typeof normalized === "string" && !/^\d+$/.test(normalized)) return null;
  if (typeof normalized !== "number" && typeof normalized !== "string") return null;
  const quantity = Number(normalized);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseItems(raw: unknown): ParsedItems | string {
  if (typeof raw !== "string") return LINE_ITEM_ERROR;
  if (raw.length > MAX_ITEMS_JSON_CHARS) return "invoice.itemsTooLarge";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return LINE_ITEM_ERROR;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return LINE_ITEM_ERROR;
  if (parsed.length > MAX_LINE_ITEMS) return "invoice.tooManyLineItems";

  const items: ParsedItems = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) return LINE_ITEM_ERROR;
    const { description, quantity, price } = entry as Record<string, unknown>;
    if (typeof description !== "string" || description.trim().length === 0) return LINE_ITEM_ERROR;
    if (description.trim().length > MAX_DESCRIPTION_CHARS) {
      return "invoice.descriptionTooLong";
    }
    const qty = parseQuantity(quantity);
    if (qty === null) return LINE_ITEM_ERROR;
    if (qty > MAX_QUANTITY) return "invoice.quantityTooLarge";
    const unitPriceCents = typeof price === "string" ? parseAmountToCents(price) : null;
    if (unitPriceCents === null) return LINE_ITEM_ERROR;
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

  if (typeof clientId !== "string" || clientId.length === 0) return "invoice.chooseClient";
  if (!isCalendarDate(issueDate)) return "invoice.invalidIssueDate";
  if (!isCalendarDate(dueDate)) return "invoice.invalidDueDate";

  let taxBps = 0;
  if (typeof taxRate === "string" && taxRate.trim().length > 0) {
    const rate = parseAmountToCents(taxRate);
    if (rate === null || rate > 5000) return "invoice.invalidTaxRate";
    taxBps = rate;
  }

  if (status !== "draft" && status !== "sent" && status !== "paid") {
    return "invoice.invalidStatus";
  }
  const documentLocale = formData.get("documentLocale");
  if (documentLocale !== null && documentLocale !== "en" && documentLocale !== "ar") {
    return "invoice.invalidDocumentLocale";
  }
  const items = parseItems(formData.get("itemsJson"));
  if (typeof items === "string") return items;
  try { calcTotals(items, taxBps); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return CALC_TOTALS_ERROR_KEYS[error.message] ?? error.message;
  }
  const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
  if (trimmedNotes.length > MAX_NOTES_CHARS) return "invoice.notesTooLong";

  return {
    clientId,
    status,
    issueDate,
    dueDate,
    taxBps,
    notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    items,
    ...(documentLocale === "en" || documentLocale === "ar" ? { documentLocale } : {}),
  };
}
