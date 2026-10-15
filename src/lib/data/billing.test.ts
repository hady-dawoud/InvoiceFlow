import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.hoisted(() => { process.env.DATABASE_URL = "file::memory:"; });
import { db } from "@/db";
import { user } from "@/db/schema";
import { createTestSchema } from "@/test/database";
import { applyStripeAction } from "./billing";

beforeAll(createTestSchema);
beforeEach(async () => {
  await db.delete(user);
  await db.insert(user).values({ id: "owner", name: "Owner", email: "owner@example.com", createdAt: new Date(), updatedAt: new Date(), isPro: true, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_new", proSince: new Date("2025-01-01") });
});
afterAll(() => db.$client.close());
async function owner() { return (await db.select().from(user))[0]; }

it("stale cancellation cannot revoke a newer subscription", async () => {
  await applyStripeAction({ type: "revoke_pro", subscriptionId: "sub_old", customerId: "cus_1" });
  expect(await owner()).toMatchObject({ isPro: true, stripeSubscriptionId: "sub_new" });
});
it("revocation preserves subscription identity for payment recovery", async () => {
  await applyStripeAction({ type: "revoke_pro", subscriptionId: "sub_new", customerId: "cus_1" });
  expect(await owner()).toMatchObject({ isPro: false, stripeSubscriptionId: "sub_new" });
  await applyStripeAction({ type: "grant_pro", userId: "owner", subscriptionId: "sub_new", customerId: "cus_1" });
  expect((await owner()).isPro).toBe(true);
});
it("a Stripe grant replaces a wallet end date with open-ended Pro", async () => {
  await db.update(user).set({ proUntil: new Date("2027-01-01T00:00:00.000Z") }).where(eq(user.id, "owner"));
  await applyStripeAction({ type: "grant_pro", userId: "owner", subscriptionId: "sub_new", customerId: "cus_1" });
  expect(await owner()).toMatchObject({ isPro: true, proUntil: null });
});
it("duplicate grant preserves the original activation date", async () => {
  await applyStripeAction({ type: "grant_pro", userId: "owner", subscriptionId: "sub_new", customerId: "cus_1" });
  expect((await owner()).proSince?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
});
it("stale recovery cannot replace a newer subscription", async () => {
  await applyStripeAction({ type: "grant_pro", userId: "owner", subscriptionId: "sub_old", customerId: "cus_1" });
  expect((await owner()).stripeSubscriptionId).toBe("sub_new");
});
it("customer mismatch cannot grant or revoke access", async () => {
  await applyStripeAction({ type: "revoke_pro", subscriptionId: "sub_new", customerId: "cus_other" });
  expect((await owner()).isPro).toBe(true);
  await applyStripeAction({ type: "grant_pro", userId: "owner", subscriptionId: "sub_new", customerId: "cus_other" });
  expect((await owner()).stripeCustomerId).toBe("cus_1");
});
