import type { InvoiceItem } from "@/db/schema";

export function centsToDecimal(cents: number): string {
  const amount = BigInt(cents);
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
}

/** Format integer cents as a currency string, e.g. 123456 + "usd" → "$1,234.56". */
export function formatCents(cents: number | bigint, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const amount = BigInt(cents);
  const whole = amount / 100n;
  const remainder = amount % 100n;
  if (digits === 0) return formatter.format(whole + (remainder >= 50n ? 1n : remainder < -50n ? -1n : 0n));
  const fraction = (remainder * (amount < 0n ? -1n : 1n)).toString().padStart(2, "0").padEnd(digits, "0");
  return formatter.formatToParts(whole === 0n && cents < 0 ? -0 : whole)
    .map((part) => part.type === "fraction" ? fraction : part.value).join("");
}

/**
 * Parse a user-typed amount ("1,200.50", "1200.5", "800") into integer cents.
 * Returns null for anything that is not a non-negative amount with ≤2 decimals.
 */
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
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
  if (!Number.isSafeInteger(taxBps) || taxBps < 0 || taxBps > 5000) {
    throw new RangeError("Invalid tax rate.");
  }
  const subtotal = items.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
        !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0) {
      throw new RangeError("Invalid line item.");
    }
    return sum + BigInt(item.quantity) * BigInt(item.unitPriceCents);
  }, 0n);
  const tax = (subtotal * BigInt(taxBps) + 5000n) / 10000n;
  if (subtotal + tax > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Invoice total is too large.");
  }
  return { subtotalCents: Number(subtotal), taxCents: Number(tax), totalCents: Number(subtotal + tax) };
}
