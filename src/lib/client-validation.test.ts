import { describe, expect, it } from "vitest";
import { parseClientInput } from "./client-validation";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ name: "Ada", email: "ada@example.com", address: "1 Main", ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("client input validation", () => {
  it("accepts a normal client", () => {
    expect(parseClientInput(form())).toEqual({
      ok: true,
      input: { name: "Ada", email: "ada@example.com", address: "1 Main" },
    });
  });

  it.each([
    ["a name over 120 characters", { name: "a".repeat(121) }, "Client name must be 120 characters or fewer."],
    ["an email over 254 characters", { email: `${"a".repeat(250)}@b.co` }, "Email must be 254 characters or fewer."],
    ["an address over 500 characters", { address: "a".repeat(501) }, "Address must be 500 characters or fewer."],
  ])("rejects %s", (_label, overrides, message) => {
    expect(parseClientInput(form(overrides))).toEqual({ ok: false, error: message });
  });
});
