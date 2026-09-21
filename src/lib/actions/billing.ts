"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getStripe, proLineItem } from "@/lib/stripe";
import { getSession } from "@/lib/session";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function upgradeToProAction(): Promise<void> {
  const session = await getSession();
  const stripe = getStripe();
  if (!stripe) redirect("/dashboard/billing?error=not-configured");

  let customerId = session.user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db
      .update(user)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [proLineItem()],
    metadata: { userId: session.user.id },
    subscription_data: { metadata: { userId: session.user.id } },
    success_url: `${appUrl()}/dashboard/billing?success=1`,
    cancel_url: `${appUrl()}/dashboard/billing?canceled=1`,
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
