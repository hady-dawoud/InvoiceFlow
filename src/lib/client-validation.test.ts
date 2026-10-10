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
    ["a name over 120 characters", { name: "a".repeat(121) }, "client.nameTooLong"],
    ["an email over 254 characters", { email: `${"a".repeat(250)}@b.co` }, "client.emailTooLong"],
    ["an address over 500 characters", { address: "a".repeat(501) }, "client.addressTooLong"],
  ])("rejects %s", (_label, overrides, message) => {
    expect(parseClientInput(form(overrides))).toEqual({ ok: false, error: message });
  });
});
