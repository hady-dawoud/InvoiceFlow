import { createTranslator } from "next-intl";
import { isOverdue, STATUS_META, type InvoiceStatus } from "@/lib/invoice";
import enMessages from "../../messages/en.json";
import arMessages from "../../messages/ar.json";

const catalogs = { en: enMessages, ar: arMessages } as const;

type BadgeLocale = keyof typeof catalogs;

/**
 * `locale` is the locale of the surface showing the badge. Dashboard lists
 * pass the UI locale; the invoice sheet passes `invoice.documentLocale`.
 */
export function StatusBadge({
  status,
  dueDate,
  locale,
}: {
  status: InvoiceStatus;
  dueDate?: string;
  locale: string;
}) {
  const badgeLocale: BadgeLocale = locale === "ar" ? "ar" : "en";
  const t = createTranslator({
    locale: badgeLocale,
    messages: catalogs[badgeLocale],
    namespace: "invoice.status",
  });
  if (status === "sent" && dueDate && isOverdue({ status, dueDate })) {
    return <span className="stamp stamp-overdue">{t("overdue")}</span>;
  }
  const meta = STATUS_META[status];
  return <span className={`stamp ${meta.className}`}>{t(status)}</span>;
}
