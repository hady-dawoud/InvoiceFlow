import Stripe from "stripe";
import { PRO_PRICE_CENTS } from "./plans";

let stripeClient: Stripe | null = null;

/** Returns null when billing is not configured — callers degrade gracefully. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

/** Stripe Price ID from the dashboard, or an inline $9/mo price is created. */
export function proLineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (priceId) return { price: priceId, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: PRO_PRICE_CENTS,
      recurring: { interval: "month" },
      product_data: { name: "InvoiceFlow Pro" },
    },
  };
}
