"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/lib/actions/locale";
import type { Locale } from "@/lib/locale";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("languageSwitcher");
  const router = useRouter();

  async function choose(next: Locale) {
    await setLocaleAction(next);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("ariaLabel")}>
      <button
        type="button"
        className={`min-h-11 px-3 text-sm font-medium ${
          locale === "en" ? "bg-ink/8 text-ink" : "text-quiet hover:text-ink"
        }`}
        aria-pressed={locale === "en"}
        onClick={() => choose("en")}
      >
        {t("en")}
      </button>
      <button
        type="button"
        className={`min-h-11 px-3 text-sm font-medium ${
          locale === "ar" ? "bg-ink/8 text-ink" : "text-quiet hover:text-ink"
        }`}
        aria-pressed={locale === "ar"}
        onClick={() => choose("ar")}
      >
        {t("ar")}
      </button>
    </div>
  );
}
