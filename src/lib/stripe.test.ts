import { afterEach, describe, expect, it } from "vitest";
import { isBillingConfigured, isTestMode } from "./stripe";

const originalKey = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalKey;
});

describe("stripe key mode", () => {
  it.each([
    ["sk_test_example", true, true],
    ["rk_test_example", true, true],
    ["rkcs_test_example", true, true],
    ["sk_live_example", true, false],
    ["rk_live_example", true, false],
    ["rkcs_live_example", true, false],
    ["", false, false],
  ])("classifies %j as configured=%s test=%s", (key, configured, testMode) => {
    process.env.STRIPE_SECRET_KEY = key;
    expect(isBillingConfigured()).toBe(configured);
    expect(isTestMode()).toBe(testMode);
  });
});
