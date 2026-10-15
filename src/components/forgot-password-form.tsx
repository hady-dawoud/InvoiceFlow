"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction } from "@/lib/actions/password-reset";
import { useRequest } from "@/lib/use-request";

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  const t = useTranslations("auth.forgot");
  const tError = useTranslations();
  const { run, pending, error, setError } = useRequest();
  const [sent, setSent] = useState(false);

  function submit(formData: FormData) {
    setSent(false);
    setError(null);
    const email = String(formData.get("email") ?? "");
    void run(async () => {
      const result = await requestPasswordResetAction(email);
      if (!result.ok) {
        setError(tError(result.error));
        return;
      }
      setSent(true);
    });
  }

  return (
    <div>
      <h1 className="display text-2xl">{t("heading")}</h1>
      <p className="mt-1 text-sm text-quiet">{t("subtitle")}</p>
      {configured ? (
        <form action={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">{t("emailLabel")}</label>
            <input id="email" name="email" type="email" required className="field mt-1" placeholder={t("emailPlaceholder")} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {sent && !error && <p className="text-sm text-quiet">{t("sent")}</p>}
          <button type="submit" disabled={pending} className="btn w-full disabled:opacity-60">
            {pending ? t("submitPending") : t("submit")}
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-quiet">{t("notConfigured")}</p>
      )}
      <p className="mt-4 text-center text-sm text-quiet">
        <Link href="/login" className="font-medium text-carbon hover:underline">{t("backToLogin")}</Link>
      </p>
    </div>
  );
}
