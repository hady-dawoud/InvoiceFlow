import { describe, expect, it } from "vitest";
import { pricingCallToAction } from "./pricing-cta";

describe("pricingCallToAction", () => {
  it.each([
    [undefined, "/signup", "startFree"],
    [{ isPro: false }, "/dashboard/billing", "upgradeToPro"],
    [{ isPro: true }, "/dashboard/billing", "manageSubscription"],
  ] as const)("chooses the next step for %j", (viewer, href, label) => {
    expect(pricingCallToAction(viewer)).toEqual({ href, label });
  });
});
