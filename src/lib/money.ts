import type { InvoiceItem } from "@/db/schema";

/** Format integer cents as a currency string, e.g. 123456 + "usd" → "$1,234.56". */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Parse a user-typed amount ("1,200.50", "1200.5", "800") into integer cents.
 * Returns null for anything that is not a non-negative amount with ≤2 decimals.
 */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(parseFloat(trimmed) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export type Totals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

/** Tax in basis points (850 = 8.5%), rounded once on the invoice subtotal. */
export function calcTotals(
  items: Pick<InvoiceItem, "quantity" | "unitPriceCents">[],
  taxBps: number,
): Totals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );
  const taxCents = Math.round((subtotalCents * taxBps) / 10_000);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
