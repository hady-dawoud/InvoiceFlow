import { describe, expect, it } from "vitest";
import { parseInvoiceInput } from "./invoice-validation";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ clientId: "c1", issueDate: "2024-02-29", dueDate: "2024-03-01", status: "draft", taxRate: "0", itemsJson: JSON.stringify([{ description: "Work", quantity: "1", price: "0" }]), ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("invoice input validation", () => {
  it.each(["1.5", "1x", "1e2", "0", "-1", "9007199254740992"])("rejects malformed quantity %s", (quantity) => {
    const result = parseInvoiceInput(form({ itemsJson: JSON.stringify([{ description: "Work", quantity, price: "1" }]) }));
    expect(typeof result).toBe("string");
  });
  it.each(["2025-02-29", "2026-04-31", "2026-00-10", "2026-13-01"])("rejects impossible date %s", (date) => {
    expect(parseInvoiceInput(form({ issueDate: date }))).toBe("Invalid issue date.");
  });
  it("preserves valid leap dates and zero prices", () => {
    expect(parseInvoiceInput(form())).toMatchObject({ issueDate: "2024-02-29", items: [{ quantity: 1, unitPriceCents: 0 }] });
  });
  it("rejects overflowing line totals", () => {
    expect(typeof parseInvoiceInput(form({ itemsJson: JSON.stringify([{ description: "Work", quantity: "2", price: "90071992547409.91" }]) }))).toBe("string");
  });
});
