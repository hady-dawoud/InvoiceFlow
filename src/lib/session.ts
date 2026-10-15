import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { proIsActive } from "@/lib/wallet-billing";

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function withProAccess<T extends { isPro: boolean; proUntil?: Date | string | null }>(
  user: T,
  now = new Date(),
): T & { proUntil: Date | null } {
  const proUntil = asDate(user.proUntil);
  return { ...user, proUntil, isPro: proIsActive({ isPro: user.isPro, proUntil }, now) };
}

export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return { ...session, user: withProAccess(session.user) };
}
