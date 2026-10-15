import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { user, walletPayment } from "@/db/schema";
import { writeTransaction } from "@/db/write-transaction";
import { recordProductEvent } from "@/lib/analytics";
import { extendProUntil, proIsActive, type WalletMethod } from "@/lib/wallet-billing";

export type WalletPaymentInput = {
  userId: string;
  method: WalletMethod;
  planId: string;
  months: number;
  amountEgp: number;
  confirmation: string;
};

export async function recordWalletPayment(input: WalletPaymentInput): Promise<{ id: string }> {
  return writeTransaction(async (tx) => {
    const [pending] = await tx.select().from(walletPayment)
      .where(and(eq(walletPayment.userId, input.userId), eq(walletPayment.status, "pending")))
      .limit(1);
    if (pending && sameCommercialTerms(pending, input)) {
      await tx.update(walletPayment).set({
        confirmation: input.confirmation,
        createdAt: new Date(),
      }).where(eq(walletPayment.id, pending.id));
      return { id: pending.id };
    }
    if (pending) await tx.delete(walletPayment).where(eq(walletPayment.id, pending.id));
    const id = randomUUID();
    await tx.insert(walletPayment).values({ id, ...input, status: "pending" });
    return { id };
  });
}

function sameCommercialTerms(
  pending: { method: string; planId: string; months: number; amountEgp: number },
  input: WalletPaymentInput,
): boolean {
  return pending.method === input.method
    && pending.planId === input.planId
    && pending.months === input.months
    && pending.amountEgp === input.amountEgp;
}

export async function activateWalletPayment(
  requestId: string,
  now: Date,
): Promise<{ proUntil: Date | null } | null> {
  const result = await writeTransaction(async (tx) => {
    const [payment] = await tx.select().from(walletPayment).where(eq(walletPayment.id, requestId)).limit(1);
    if (!payment) return null;
    const [account] = await tx.select().from(user).where(eq(user.id, payment.userId)).limit(1);
    if (!account) return null;
    if (payment.status === "activated") return { proUntil: account.proUntil, userId: account.id, converted: false };

    const openEnded = account.isPro && account.proUntil == null;
    const proUntil = openEnded ? null : extendProUntil(account.proUntil, now, payment.months);
    const converted = !proIsActive({ isPro: account.isPro, proUntil: account.proUntil }, now);
    await tx.update(user).set({
      isPro: true,
      proUntil,
      proSince: account.proSince ?? now,
      updatedAt: now,
    }).where(eq(user.id, account.id));
    await tx.update(walletPayment).set({
      status: "activated",
      activatedAt: now,
    }).where(eq(walletPayment.id, payment.id));
    return { proUntil, userId: account.id, converted };
  });
  if (!result) return null;
  if (result.converted) await recordProductEvent("pro_conversion", result.userId);
  return { proUntil: result.proUntil };
}
