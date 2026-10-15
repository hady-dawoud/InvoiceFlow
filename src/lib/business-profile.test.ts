import { describe, expect, it } from "vitest";
import { parseBusinessProfile } from "./business-profile";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({
    businessName: "  Ada Studio  ",
    currency: "EUR",
    taxId: "  ",
    paymentInstructions: "  ",
    ...overrides,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("business profile input", () => {
  it("stores a trimmed name, a lowercase currency, and blank payment details as empty", () => {
    expect(parseBusinessProfile(form())).toEqual({
      ok: true,
      profile: { businessName: "Ada Studio", currency: "eur", taxId: null, paymentInstructions: null },
    });
  });

  it.each([
    ["a blank name", { businessName: "  " }, "business.nameRequired"],
    ["a name over 120 characters", { businessName: "a".repeat(121) }, "business.nameTooLong"],
    ["an unknown currency", { currency: "btc" }, "business.invalidCurrency"],
    ["a tax id over 40 characters", { taxId: "a".repeat(41) }, "business.taxIdTooLong"],
    ["instructions over 500 characters", { paymentInstructions: "a".repeat(501) }, "business.instructionsTooLong"],
  ])("rejects %s", (_label, overrides, error) => {
    expect(parseBusinessProfile(form(overrides))).toEqual({ ok: false, error });
  });
});
