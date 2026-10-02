import type Stripe from "stripe";
import { getBillingAccount } from "@/lib/data/billing";
import { CHECKOUT_EVENTS, SUBSCRIPTION_EVENTS, INVOICE_EVENTS, ENDED_STATUSES, decideStripeAction, stripeId, type StripeAction, type StripeEventLike } from "./stripe-events";

function invoiceSubscription(object: Record<string, unknown>) {
  const parent = object.parent as { subscription_details?: { subscription?: unknown } } | null;
  return stripeId(object.subscription) ?? stripeId(parent?.subscription_details?.subscription);
}

async function allowReplacement(stripe: Stripe, action: StripeAction): Promise<StripeAction> {
  if (action.type !== "grant_pro") return action;
  const account = await getBillingAccount(action.customerId);
  const storedId = account?.stripeSubscriptionId;
  if (!storedId || storedId === action.subscriptionId) return action;
  const previous = await stripe.subscriptions.retrieve(storedId);
  return ENDED_STATUSES.has(previous.status) ? { ...action, replaceSubscriptionId: storedId } : action;
}

export async function resolveStripeAction(stripe: Stripe, event: StripeEventLike): Promise<StripeAction> {
  const object = event.data.object;
  if (CHECKOUT_EVENTS.has(event.type)) {
    const sessionId = stripeId(object.id);
    if (!sessionId) return { type: "ignore", reason: "missing checkout id" };
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const subscriptionId = stripeId(session.subscription);
    if (!subscriptionId) return { type: "ignore", reason: "checkout has no subscription" };
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (stripeId(subscription.customer) !== stripeId(session.customer)) return { type: "ignore", reason: "customer mismatch" };
    const action = decideStripeAction({ type: event.type, data: { object: { ...session, subscriptionStatus: subscription.status } } });
    return allowReplacement(stripe, action);
  }
  const subscriptionId = SUBSCRIPTION_EVENTS.has(event.type) ? stripeId(object.id)
    : INVOICE_EVENTS.has(event.type) ? invoiceSubscription(object) : null;
  if (!subscriptionId) return { type: "ignore", reason: "unhandled event or missing subscription" };
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return decideStripeAction({ type: "customer.subscription.updated", data: { object: subscription as unknown as Record<string, unknown> } });
}
