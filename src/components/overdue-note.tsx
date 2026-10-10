"use client";

import { useTranslations } from "next-intl";

export function OverdueNote({ amount }: { amount: string }) {
  const t = useTranslations("dashboard.home");
  return t.rich("overdueNote", {
    amount,
    ltr: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
  });
}
