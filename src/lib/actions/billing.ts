"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getStripe, proLineItem } from "@/lib/stripe";
import { ENDED_STATUSES } from "@/lib/stripe-events";
import type Stripe from "stripe";
import type { User } from "@/db/schema";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/session";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

async function requireUpgradeEligibility(stripe: Stripe, account: User) {
  if (account.isPro) redirect("/dashboard/billing");
  if (account.stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId);
    if (!ENDED_STATUSES.has(subscription.status)) redirect("/dashboard/billing?error=existing-subscription");
  }
  if (!account.stripeCustomerId) return;
  for await (const subscription of stripe.subscriptions.list({ customer: account.stripeCustomerId, status: "all", limit: 100 })) {
    if (!ENDED_STATUSES.has(subscription.status)) redirect("/dashboard/billing?error=existing-subscription");
  }
}

async function ensureCustomer(stripe: Stripe, account: User): Promise<string> {
  if (account.stripeCustomerId) return account.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: account.email, name: account.name, metadata: { userId: account.id },
  }, { idempotencyKey: `invoiceflow-customer-${account.id}` });
  await db.update(user).set({ stripeCustomerId: customer.id, updatedAt: new Date() }).where(eq(user.id, account.id));
  return customer.id;
}

export async function upgradeToProAction(): Promise<void> {
  const session = await getSession();
  const stripe = getStripe();
  if (!stripe) redirect("/dashboard/billing?error=not-configured");
  const [account] = await db.select().from(user).where(eq(user.id, session.user.id));
  if (!account) redirect("/login");
  await requireUpgradeEligibility(stripe, account);
  const customerId = await ensureCustomer(stripe, account);
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    integration_identifier: `invoiceflow_${Array.from(randomBytes(8), (value) => String.fromCharCode(97 + value % 26)).join("")}`,
    customer: customerId, line_items: [proLineItem()], metadata: { userId: account.id },
    subscription_data: { metadata: { userId: account.id } },
    success_url: `${appUrl()}/dashboard/billing?success=1`, cancel_url: `${appUrl()}/dashboard/billing?canceled=1`,
  });
  if (!checkout.url) redirect("/dashboard/billing?error=checkout-failed");
  redirect(checkout.url);
}

export async function openCustomerPortalAction(): Promise<void> {
  const session = await getSession();
  const stripe = getStripe();
  if (!stripe) redirect("/dashboard/billing?error=not-configured");

  const customerId = session.user.stripeCustomerId;
  if (!customerId) redirect("/dashboard/billing?error=no-subscription");

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl()}/dashboard/billing`,
  });
  redirect(portal.url);
}
