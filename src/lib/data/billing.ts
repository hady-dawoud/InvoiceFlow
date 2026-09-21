import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import type { StripeAction } from "@/lib/stripe-events";

export async function applyStripeAction(action: StripeAction): Promise<void> {
  if (action.type === "grant_pro") {
    await db
      .update(user)
      .set({
        isPro: true,
        stripeCustomerId: action.customerId,
        stripeSubscriptionId: action.subscriptionId,
        proSince: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, action.userId));
    return;
  }

  if (action.type === "revoke_pro") {
    const revoke = {
      isPro: false,
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    };
    // Prefer the subscription id; fall back to the customer when the
    // subscription id was never stored (e.g. user row created before webhooks).
    if (action.subscriptionId) {
      const updated = await db
        .update(user)
        .set(revoke)
        .where(eq(user.stripeSubscriptionId, action.subscriptionId))
        .returning({ id: user.id });
      if (updated.length > 0) return;
    }
    if (action.customerId) {
      await db
        .update(user)
        .set(revoke)
        .where(eq(user.stripeCustomerId, action.customerId));
    }
  }
}
