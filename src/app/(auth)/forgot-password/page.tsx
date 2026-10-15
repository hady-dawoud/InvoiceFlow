import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { passwordResetConfigured } from "@/lib/password-reset";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("heading") };
}

export default async function ForgotPasswordPage() {
  return <ForgotPasswordForm configured={passwordResetConfigured()} />;
}
