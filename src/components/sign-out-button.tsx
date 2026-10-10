"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRequest } from "@/lib/use-request";
import { signOutFailureMessage } from "@/lib/auth-error";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("dashboard.signOut");
  const { run, pending, error, setError } = useRequest();
  return (
    <div>
    <button
      disabled={pending}
      onClick={async () => {
        const result = await run(() => signOut());
        if (!result) return;
        if (result.error) { setError(signOutFailureMessage(t, result.error)); return; }
        router.push("/login");
        router.refresh();
      }}
      className="btn btn-ghost"
    >
      {t("label")}
    </button>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
