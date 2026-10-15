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
    expect(parseInvoiceInput(form({ issueDate: date }))).toBe("invoice.invalidIssueDate");
  });
  it("preserves valid leap dates and zero prices", () => {
    expect(parseInvoiceInput(form())).toMatchObject({ issueDate: "2024-02-29", items: [{ quantity: 1, unitPriceCents: 0 }] });
  });
  it("accepts an Arabic-Indic quantity", () => {
    expect(parseInvoiceInput(form({ itemsJson: JSON.stringify([{ description: "Work", quantity: "٢", price: "١" }]) }))).toMatchObject({
      items: [{ quantity: 2, unitPriceCents: 100 }],
    });
  });
  it("rejects overflowing line totals", () => {
    expect(typeof parseInvoiceInput(form({ itemsJson: JSON.stringify([{ description: "Work", quantity: "2", price: "90071992547409.91" }]) }))).toBe("string");
  });
  it.each(["fr", "arc", "EN", ""])("rejects document locale %s", (documentLocale) => {
    expect(parseInvoiceInput(form({ documentLocale }))).toBe("invoice.invalidDocumentLocale");
  });
  it.each(["en", "ar"] as const)("accepts document locale %s", (documentLocale) => {
    expect(parseInvoiceInput(form({ documentLocale }))).toMatchObject({ documentLocale });
  });
  it.each([
    ["a description over 400 characters", { itemsJson: JSON.stringify([{ description: "x".repeat(401), quantity: "1", price: "1" }]) }, "invoice.descriptionTooLong"],
    ["more than 40 line items", { itemsJson: JSON.stringify(Array.from({ length: 41 }, () => ({ description: "Work", quantity: "1", price: "1" }))) }, "invoice.tooManyLineItems"],
    ["a quantity over one million", { itemsJson: JSON.stringify([{ description: "Work", quantity: "1000001", price: "1" }]) }, "invoice.quantityTooLarge"],
    ["an items payload over 100kb", { itemsJson: "x".repeat(100_001) }, "invoice.itemsTooLarge"],
    ["notes over 2000 characters", { notes: "x".repeat(2001) }, "invoice.notesTooLong"],
  ])("rejects %s", (_label, overrides, message) => {
    expect(parseInvoiceInput(form(overrides))).toBe(message);
  });
});
