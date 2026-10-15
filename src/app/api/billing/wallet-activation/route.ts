import { revalidatePath } from "next/cache";
import { activateWalletPayment } from "@/lib/data/wallet-payments";
import { activationAuthorized } from "@/lib/wallet-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.BILLING_ACTIVATION_SECRET;
  if (!secret) return Response.json({ error: "billing not configured" }, { status: 503 });
  if (!activationAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const requestId = typeof body === "object" && body !== null && "requestId" in body
    ? body.requestId
    : "";
  if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const result = await activateWalletPayment(requestId, new Date());
  if (!result) return Response.json({ error: "not found" }, { status: 404 });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
  return Response.json({ proUntil: result.proUntil?.toISOString() ?? null });
}
