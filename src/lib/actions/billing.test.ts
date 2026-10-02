import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const boundary = await vi.hoisted(async () => {
  const { randomBytes } = await import("node:crypto");
  process.env.DATABASE_URL = "file::memory:";
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.APP_URL = "http://localhost:3000";
  process.env.STRIPE_SECRET_KEY = "sk_test_offline_fixture";
  return { cookie: "", ownerId: "", subscriptionStatus: "active", storedStatus: "canceled", active: false, customers: new Map<string, string>(), sequence: 0 };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: boundary.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
// Stripe's HTTP boundary stays offline; authentication and persistence are real.
vi.mock("stripe", async (original) => {
  const { default: Stripe } = await original<typeof import("stripe")>();
  return { default: class extends Stripe {
    constructor(key: string) {
      super(key, { httpClient: Stripe.createFetchHttpClient(async (url, init) => {
        const path = new URL(String(url)).pathname;
        let body: unknown;
        if (path === "/v1/subscriptions") body = { data: boundary.active ? [{ id: "sub_active", status: "active" }] : [], has_more: false };
        else if (path.startsWith("/v1/subscriptions/")) body = { id: path.split("/").at(-1), customer: "cus_existing", status: path.endsWith("sub_old") ? boundary.storedStatus : boundary.subscriptionStatus, metadata: { userId: boundary.ownerId } };
        else if (path === "/v1/checkout/sessions/cs_current") body = { id: "cs_current", customer: "cus_existing", subscription: "sub_current", payment_status: "paid", metadata: { userId: boundary.ownerId } };
        else if (path === "/v1/customers") {
          const key = new Headers(init?.headers).get("idempotency-key") ?? `missing-${++boundary.sequence}`;
          if (!boundary.customers.has(key)) boundary.customers.set(key, `cus_${++boundary.sequence}`);
          body = { id: boundary.customers.get(key) };
        } else if (path === "/v1/checkout/sessions") body = { url: "https://checkout.stripe.test/session" };
        else if (path === "/v1/billing_portal/sessions") body = { url: "https://billing.stripe.test/portal" };
        else throw new Error(`Unexpected offline Stripe endpoint: ${path}`);
        return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
      }) });
    }
  } };
});

import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveStripeAction } from "@/lib/stripe-webhook";
import { getStripe } from "@/lib/stripe";
import { applyStripeAction } from "@/lib/data/billing";
import { auth } from "@/lib/auth";
import { createTestSchema } from "@/test/database";
import { openCustomerPortalAction, upgradeToProAction } from "./billing";
let ownerId: string;

beforeAll(createTestSchema);
beforeEach(async () => {
  await db.delete(user);
  boundary.active = false;
  boundary.subscriptionStatus = "active";
  boundary.storedStatus = "canceled";
  boundary.customers.clear();
  boundary.sequence = 0;
  const response = await auth.api.signUpEmail({ body: { name: "Owner", email: "owner@example.com", password: "testing-password" }, asResponse: true });
  expect(response.status).toBe(200);
  boundary.cookie = response.headers.get("set-cookie")!.split(";")[0];
  ownerId = (await db.select().from(user))[0].id;
  boundary.ownerId = ownerId;
});
afterAll(() => db.$client.close());

it("blocks a new upgrade when Stripe already has an active subscription", async () => {
  await db.update(user).set({ stripeCustomerId: "cus_existing" }).where(eq(user.id, ownerId));
  boundary.active = true;
  await expect(upgradeToProAction()).rejects.toThrow("redirect:/dashboard/billing?error=existing-subscription");
});
it("concurrent upgrades store one idempotently created customer", async () => {
  const results = await Promise.allSettled([upgradeToProAction(), upgradeToProAction()]);
  expect(results.every((result) => result.status === "rejected" && String(result.reason).includes("https://checkout.stripe.test/session"))).toBe(true);
  expect((await db.select().from(user))[0].stripeCustomerId).toBe("cus_1");
});
it("a customer who has lost Pro can still open the portal", async () => {
  await db.update(user).set({ stripeCustomerId: "cus_existing", isPro: false }).where(eq(user.id, ownerId));
  await expect(openCustomerPortalAction()).rejects.toThrow("redirect:https://billing.stripe.test/portal");
});

it.each([
  ["customer.subscription.deleted", { id: "sub_current", status: "canceled" }, "active"],
  ["invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_current" } } }, "past_due"],
  ["invoice.paid", { parent: { subscription_details: { subscription: "sub_current" } } }, "active"],
  ["checkout.session.async_payment_failed", { id: "cs_current", payment_status: "unpaid" }, "active"],
])("delayed %s reconciles current Stripe state (%s)", async (type, object, status) => {
  await db.update(user).set({ stripeCustomerId: "cus_existing", stripeSubscriptionId: "sub_current" }).where(eq(user.id, ownerId));
  boundary.subscriptionStatus = status;
  const action = await resolveStripeAction(getStripe()!, { type, data: { object } });
  await applyStripeAction(action);
  expect((await db.select().from(user))[0]).toMatchObject({ isPro: true, stripeSubscriptionId: "sub_current" });
});
it("replacement checkout cannot be undone by a delayed old cancellation", async () => {
  await db.update(user).set({ stripeCustomerId: "cus_existing", stripeSubscriptionId: "sub_old" }).where(eq(user.id, ownerId));
  const action = await resolveStripeAction(getStripe()!, { type: "checkout.session.completed", data: { object: { id: "cs_current" } } });
  await applyStripeAction(action);
  const stale = await resolveStripeAction(getStripe()!, { type: "customer.subscription.deleted", data: { object: { id: "sub_old" } } });
  await applyStripeAction(stale);
  expect((await db.select().from(user))[0]).toMatchObject({ isPro: true, stripeSubscriptionId: "sub_current" });
});
