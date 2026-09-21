import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { applyStripeAction } from "@/lib/data/billing";
import { decideStripeAction } from "@/lib/stripe-events";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "billing not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  const action = decideStripeAction({
    type: event.type,
    data: { object: event.data.object as unknown as Record<string, unknown> },
  });
  await applyStripeAction(action);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");

  return Response.json({ received: true, action: action.type });
}
