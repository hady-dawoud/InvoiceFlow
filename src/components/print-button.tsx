"use client";

import { useTranslations } from "next-intl";

export function PrintButton() {
  const t = useTranslations("invoice.print");
  return (
    <button
      onClick={() => window.print()}
      className="btn"
    >
      {t("button")}
    </button>
  );
}
