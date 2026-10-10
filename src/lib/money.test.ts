import { describe, expect, it } from "vitest";
import { calcTotals, centsToDecimal, formatCents, parseAmountToCents } from "@/lib/money";

it.each([0, 5, 123456, 9007199254740990, Number.MAX_SAFE_INTEGER])(
  "opening and saving a price preserves every cent (%i)", (cents) => {
    expect(parseAmountToCents(centsToDecimal(cents))).toBe(cents);
  },
);

describe("formatCents", () => {
  it("preserves cents when formatting the largest safe amount", () => {
    expect(formatCents(Number.MAX_SAFE_INTEGER, "usd")).toBe("$90,071,992,547,409.91");
  });
  it("formats integer cents as currency", () => {
    expect(formatCents(123456, "usd")).toBe("$1,234.56");
    expect(formatCents(0, "usd")).toBe("$0.00");
    expect(formatCents(5, "usd")).toBe("$0.05");
    expect(formatCents(5000, "usd")).toBe("$50.00");
    expect(formatCents(-5000, "usd")).toBe("-$50.00");
  });

  it("handles large amounts with thousand separators", () => {
    expect(formatCents(123456789, "usd")).toBe("$1,234,567.89");
  });
});

describe("parseAmountToCents", () => {
  it("parses cents exactly at the safe-integer boundary", () => {
    expect(parseAmountToCents("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseAmountToCents("90071992547409.92")).toBeNull();
  });
  it("parses common user input", () => {
    expect(parseAmountToCents("1200")).toBe(120000);
    expect(parseAmountToCents("1200.5")).toBe(120050);
    expect(parseAmountToCents("1,200.50")).toBe(120050);
    expect(parseAmountToCents(" 0.10 ")).toBe(10);
  });

  it("rejects invalid input", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("-5")).toBeNull();
    expect(parseAmountToCents("1.234")).toBeNull();
    expect(parseAmountToCents("12.")).toBeNull();
    expect(parseAmountToCents("1e5")).toBeNull();
  });
});

describe("calcTotals", () => {
  it.each([
    [[{ quantity: 2, unitPriceCents: Number.MAX_SAFE_INTEGER }], 0],
    [[{ quantity: 1, unitPriceCents: Number.MAX_SAFE_INTEGER }], 1],
    [[{ quantity: 1.5, unitPriceCents: 100 }], 0],
  ])("rejects totals outside exact integer arithmetic (%j, %i)", (items, tax) => {
    expect(() => calcTotals(items, tax)).toThrow(RangeError);
  });
  it("sums line items and applies tax in basis points", () => {
    const items = [
      { quantity: 2, unitPriceCents: 5000 },
      { quantity: 1, unitPriceCents: 10000 },
    ];
    expect(calcTotals(items, 850)).toEqual({
      subtotalCents: 20000,
      taxCents: 1700,
      totalCents: 21700,
    });
  });

  it("handles zero tax and empty invoices", () => {
    expect(calcTotals([], 0)).toEqual({
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("rounds tax once on the subtotal, not per item", () => {
    // Three 1-cent items at 50%: per-invoice 3¢ × 50% = 1.5¢ → 2¢.
    // Per-item rounding would give round(0.5) × 3 = 3¢.
    const items = [
      { quantity: 1, unitPriceCents: 1 },
      { quantity: 1, unitPriceCents: 1 },
      { quantity: 1, unitPriceCents: 1 },
    ];
    expect(calcTotals(items, 5000).taxCents).toBe(2);
  });
});
