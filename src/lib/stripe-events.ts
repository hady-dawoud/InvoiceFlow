/**
 * Pure Stripe webhook → state-machine mapping. Kept free of I/O so the
 * billing transitions can be unit-tested without Stripe or a database.
 */

export type StripeAction =
  | {
      type: "grant_pro";
      userId: string;
      customerId: string;
      subscriptionId: string | null;
    }
  | { type: "revoke_pro"; subscriptionId: string | null; customerId: string | null }
  | { type: "ignore"; reason: string };

export type StripeEventLike = {
  type: string;
  data: { object: Record<string, unknown> };
};

/** Subscription statuses that keep Pro access; anything else revokes it. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function decideStripeAction(event: StripeEventLike): StripeAction {
  const object = event.data.object;
  const metadata = (object.metadata ?? null) as Record<string, unknown> | null;

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = str(metadata?.userId) ?? str(object.client_reference_id);
      const customerId = str(object.customer);
      if (!userId || !customerId) {
        return { type: "ignore", reason: "checkout session missing userId or customer" };
      }
      return {
        type: "grant_pro",
        userId,
        customerId,
        subscriptionId: str(object.subscription),
      };
    }

    case "customer.subscription.deleted": {
      return {
        type: "revoke_pro",
        subscriptionId: str(object.id),
        customerId: str(object.customer),
      };
    }

    case "customer.subscription.updated": {
      const status = str(object.status);
      if (!status) return { type: "ignore", reason: "subscription without status" };
      if (ACTIVE_STATUSES.has(status)) {
        return { type: "ignore", reason: `status ${status} keeps Pro` };
      }
      return {
        type: "revoke_pro",
        subscriptionId: str(object.id),
        customerId: str(object.customer),
      };
    }

    default:
      return { type: "ignore", reason: `unhandled event ${event.type}` };
  }
}
