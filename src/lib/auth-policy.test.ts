import { describe, expect, it } from "vitest";
import { trustedOrigins } from "./auth-policy";

describe("auth origin policy", () => {
  it.each([
    ["https://invoiceflow.dev/", ["https://invoiceflow.dev"]],
    ["  https://invoiceflow.dev/  ", ["https://invoiceflow.dev"]],
    ["", undefined],
    ["   ", undefined],
    [undefined, undefined],
  ])("normalizes %j", (appUrl, expected) => {
    expect(trustedOrigins(appUrl)).toEqual(expected);
  });
});
