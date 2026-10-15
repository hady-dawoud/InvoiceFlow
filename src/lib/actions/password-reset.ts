"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { passwordResetConfigured } from "@/lib/password-reset";

export type PasswordResetRequestResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordResetAction(email: string): Promise<PasswordResetRequestResult> {
  if (!passwordResetConfigured()) return { ok: false, error: "auth.forgot.notConfigured" };
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { ok: false, error: "auth.forgot.invalidEmail" };
  await auth.api.requestPasswordReset({
    body: { email: trimmed, redirectTo: "/reset-password" },
    headers: await headers(),
  });
  return { ok: true };
}
