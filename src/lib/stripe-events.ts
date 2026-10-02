export type StripeAction =
  | { type: "grant_pro"; userId: string | null; customerId: string; subscriptionId: string; replaceSubscriptionId?: string }
  | { type: "revoke_pro"; subscriptionId: string; customerId: string }
  | { type: "ignore"; reason: string };

export type StripeEventLike = { type: string; data: { object: Record<string, unknown> } };
export const ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);
export const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);
export const CHECKOUT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);
export const SUBSCRIPTION_EVENTS = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"]);
export const INVOICE_EVENTS = new Set(["invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"]);

export function stripeId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "object" && value !== null && "id" in value) return stripeId(value.id);
  return null;
}

function metadataUser(object: Record<string, unknown>) {
  const metadata = object.metadata;
  return typeof metadata === "object" && metadata !== null && "userId" in metadata ? stripeId(metadata.userId) : null;
}

export function decideStripeAction(event: StripeEventLike): StripeAction {
  const object = event.data.object;
  const checkout = CHECKOUT_EVENTS.has(event.type);
  if (!checkout && !SUBSCRIPTION_EVENTS.has(event.type)) return { type: "ignore", reason: "unhandled event" };
  const customerId = stripeId(object.customer);
  const subscriptionId = stripeId(checkout ? object.subscription : object.id);
  if (!customerId || !subscriptionId) return { type: "ignore", reason: "missing subscription identity" };
  const userId = metadataUser(object) ?? (checkout ? stripeId(object.client_reference_id) : null);
  if (checkout) {
    const eligible = object.payment_status === "paid" || object.payment_status === "no_payment_required";
    if (!userId || !eligible || !ACCESS_STATUSES.has(String(object.subscriptionStatus))) {
      return { type: "ignore", reason: "checkout awaiting eligible payment and subscription" };
    }
    return { type: "grant_pro", userId, customerId, subscriptionId };
  }
  const status = object.status;
  if (event.type !== "customer.subscription.deleted" && typeof status !== "string") return { type: "ignore", reason: "missing status" };
  return event.type !== "customer.subscription.deleted" && ACCESS_STATUSES.has(String(status))
    ? { type: "grant_pro", userId, customerId, subscriptionId }
    : { type: "revoke_pro", customerId, subscriptionId };
}
