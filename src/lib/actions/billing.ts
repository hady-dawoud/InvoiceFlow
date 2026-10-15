"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { recordWalletPayment } from "@/lib/data/wallet-payments";
import { getStripe, proLineItem } from "@/lib/stripe";
import {
  deliverWalletNotice,
  parseWalletSubmission,
  paymentNotice,
  walletChannels,
} from "@/lib/wallet-billing";
import { ENDED_STATUSES } from "@/lib/stripe-events";
import { checkoutLocale, createPortalSession, portalLocale } from "@/lib/stripe-locale";
import { resolveLocale } from "@/lib/locale";
import { siteOrigin } from "@/lib/site";
import type Stripe from "stripe";
import type { User } from "@/db/schema";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/session";

const LOCALE_COOKIE = "invoiceflow_locale";

/** Copied from Stripe.BillingPortal.SessionCreateParams.Locale (SDK enum). */
const PORTAL_LOCALES = [
  "auto",
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-IE",
  "en-IN",
  "en-NZ",
  "en-SG",
  "es",
  "es-419",
  "et",
  "fi",
  "fil",
  "fr",
  "fr-CA",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "lt",
  "lv",
  "ms",
  "mt",
  "nb",
  "nl",
  "pl",
  "pt",
  "pt-BR",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "th",
  "tr",
  "vi",
  "zh",
  "zh-HK",
  "zh-TW",
] as const;

function appUrl(): string {
  return siteOrigin();
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = rest.join("=");
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

async function requestStripeLocale(): Promise<{ cookie: string | null; locale: "en" | "ar" }> {
  const headerStore = await headers();
  const cookie = cookieValue(headerStore.get("cookie"), LOCALE_COOKIE);
  return {
    cookie,
    locale: resolveLocale({ cookie, acceptLanguage: headerStore.get("accept-language") }),
  };
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
    locale: checkoutLocale(await requestStripeLocale()),
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

  const url = await createPortalSession(
    portalLocale(await requestStripeLocale(), PORTAL_LOCALES),
    async (locale) => {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl()}/dashboard/billing`,
        locale: locale as Stripe.BillingPortal.SessionCreateParams.Locale,
      });
      return portal.url;
    },
  );
  redirect(url);
}

export async function submitWalletPaymentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const parsed = parseWalletSubmission({
    plan: formData.get("plan"),
    method: formData.get("method"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.ok) redirect("/dashboard/billing?error=invalid");
  const channels = walletChannels(process.env);
  if (channels.length === 0) redirect("/dashboard/billing?error=not-configured");
  const saved = await recordWalletPayment({
    userId: session.user.id,
    method: parsed.method,
    planId: parsed.plan.id,
    months: parsed.plan.months,
    amountEgp: parsed.plan.amountEgp,
    confirmation: parsed.confirmation,
  });
  try {
    await deliverWalletNotice(paymentNotice({
      requestId: saved.id,
      userId: session.user.id,
      email: session.user.email,
      method: parsed.method,
      months: parsed.plan.months,
      amountEgp: parsed.plan.amountEgp,
      confirmation: parsed.confirmation,
    }), channels, fetch);
  } catch {
    redirect("/dashboard/billing?error=notify");
  }
  redirect("/dashboard/billing?sent=1");
}
