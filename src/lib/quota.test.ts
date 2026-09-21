import { describe, expect, it } from "vitest";
import { FREE_MONTHLY_LIMIT, getQuotaState, startOfMonth } from "@/lib/quota";

describe("getQuotaState", () => {
  it("allows free users below the limit", () => {
    const state = getQuotaState(false, 0);
    expect(state).toMatchObject({
      isPro: false,
      used: 0,
      limit: FREE_MONTHLY_LIMIT,
      remaining: FREE_MONTHLY_LIMIT,
      blocked: false,
    });
  });

  it("warns but does not block at the last free invoice", () => {
    const state = getQuotaState(false, FREE_MONTHLY_LIMIT - 1);
    expect(state.remaining).toBe(1);
    expect(state.blocked).toBe(false);
  });

  it("blocks free users at and above the limit", () => {
    expect(getQuotaState(false, FREE_MONTHLY_LIMIT).blocked).toBe(true);
    expect(getQuotaState(false, FREE_MONTHLY_LIMIT + 4).blocked).toBe(true);
    expect(getQuotaState(false, FREE_MONTHLY_LIMIT + 4).remaining).toBe(0);
  });

  it("never blocks Pro users", () => {
    const state = getQuotaState(true, 500);
    expect(state.blocked).toBe(false);
    expect(state.limit).toBeNull();
  });
});

describe("startOfMonth", () => {
  it("returns midnight on the 1st of the month", () => {
    const start = startOfMonth(new Date(2026, 8, 21, 15, 42)); // Sep 21 2026
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("works in January (year boundary)", () => {
    const start = startOfMonth(new Date(2026, 0, 15));
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(2026);
  });
});
