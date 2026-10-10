"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRequest } from "@/lib/use-request";
import { loginFailureMessage } from "@/lib/auth-error";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { run, pending, error, setError } = useRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => signIn.email({ email, password }));
    if (!result) return;
    const { error } = result;
    if (error) {
      setError(loginFailureMessage(t, error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="display text-2xl">{t("heading")}</h1>
      <p className="mt-1 text-sm text-quiet">{t("subtitle")}</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            {t("emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-1"
            placeholder={t("emailPlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            {t("passwordLabel")}
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1"
            placeholder={t("passwordPlaceholder")}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn w-full"
        >
          {pending ? t("submitPending") : t("submit")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-quiet">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-carbon hover:underline">
          {t("signupCta")}
        </Link>
      </p>
    </div>
  );
}
