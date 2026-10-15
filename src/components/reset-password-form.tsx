"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { resetFailureMessage } from "@/lib/auth-error";
import { useRequest } from "@/lib/use-request";

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const { run, pending, error, setError } = useRequest();
  const [done, setDone] = useState(false);

  function submit(formData: FormData) {
    setError(null);
    const newPassword = String(formData.get("password") ?? "");
    void run(async () => {
      const result = await authClient.resetPassword({ newPassword, token: token ?? "" });
      if (result.error) {
        setError(resetFailureMessage(t, result.error));
        return;
      }
      setDone(true);
    });
  }

  return (
    <div>
      <h1 className="display text-2xl">{t("heading")}</h1>
      {!token || linkError ? (
        <p className="mt-4 text-sm text-quiet">{t("invalidLink")}</p>
      ) : done ? (
        <p className="mt-4 text-sm text-quiet">{t("done")}</p>
      ) : (
        <form action={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium">{t("passwordLabel")}</label>
            <input id="password" name="password" type="password" required minLength={8} className="field mt-1" placeholder={t("passwordPlaceholder")} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={pending} className="btn w-full disabled:opacity-60">
            {pending ? t("submitPending") : t("submit")}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-quiet">
        <Link href="/login" className="font-medium text-carbon hover:underline">{t("signInCta")}</Link>
      </p>
    </div>
  );
}
