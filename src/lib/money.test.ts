import { describe, expect, it } from "vitest";
import { calcTotals, formatCents, parseAmountToCents } from "@/lib/money";

describe("formatCents", () => {
  it("formats integer cents as currency", () => {
    expect(formatCents(123456, "usd")).toBe("$1,234.56");
    expect(formatCents(0, "usd")).toBe("$0.00");
    expect(formatCents(5, "usd")).toBe("$0.05");
  });

  it("handles large and negative amounts", () => {
    expect(formatCents(123456789, "usd")).toBe("$1,234,567.89");
    expect(formatCents(-2500, "usd")).toBe("-$25.00");
  });

  it("honors non-USD currencies", () => {
    expect(formatCents(1000, "eur")).toBe("€10.00");
  });
});

describe("parseAmountToCents", () => {
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
    // 3 items of 1 cent at 8.5%: per-item rounding would give 0+0+0 or 1 cent;
    // per-invoice rounding of 0.03 cents → 0.
    const items = [
      { quantity: 1, unitPriceCents: 1 },
      { quantity: 1, unitPriceCents: 1 },
      { quantity: 1, unitPriceCents: 1 },
    ];
    expect(calcTotals(items, 850).taxCents).toBe(0);
  });
});
