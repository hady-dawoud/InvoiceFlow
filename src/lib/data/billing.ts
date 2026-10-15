import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { recordProductEvent } from "@/lib/analytics";
import type { StripeAction } from "@/lib/stripe-events";

export async function getBillingAccount(customerId: string) {
  const [account] = await db.select().from(user).where(eq(user.stripeCustomerId, customerId)).limit(1);
  return account;
}

export async function applyStripeAction(action: StripeAction): Promise<void> {
  if (action.type === "ignore") return;
  const subscriptionMatches = or(isNull(user.stripeSubscriptionId), eq(user.stripeSubscriptionId, action.subscriptionId),
    action.type === "grant_pro" && action.replaceSubscriptionId ? eq(user.stripeSubscriptionId, action.replaceSubscriptionId) : undefined);
  const identity = action.type === "grant_pro" && action.userId
    ? and(eq(user.id, action.userId), eq(user.stripeCustomerId, action.customerId))
    : eq(user.stripeCustomerId, action.customerId);
  const granting = action.type === "grant_pro";
  const matches = and(identity, subscriptionMatches);
  const [previous] = granting
    ? await db.select({ id: user.id, isPro: user.isPro }).from(user).where(matches).limit(1)
    : [];
  await db.update(user).set({
    isPro: granting,
    stripeCustomerId: action.customerId,
    stripeSubscriptionId: action.subscriptionId,
    proSince: granting ? sql`CASE WHEN ${user.isPro} = 1 THEN ${user.proSince} ELSE ${Math.floor(Date.now() / 1000)} END` : user.proSince,
    ...(granting ? { proUntil: null } : {}),
    updatedAt: new Date(),
  }).where(matches);
  if (previous && !previous.isPro) await recordProductEvent("pro_conversion", previous.id);
}
