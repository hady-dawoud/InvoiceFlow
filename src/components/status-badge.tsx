import { getTranslations } from "next-intl/server";
import { STATUS_META } from "@/lib/invoice";
import { isOverdue } from "@/lib/invoice";

export async function StatusBadge({
  status,
  dueDate,
}: {
  status: "draft" | "sent" | "paid";
  dueDate?: string;
}) {
  const t = await getTranslations("invoice.status");
  if (status === "sent" && dueDate && isOverdue({ status, dueDate })) {
    return <span className="stamp stamp-overdue">{t("overdue")}</span>;
  }
  const meta = STATUS_META[status];
  return <span className={`stamp ${meta.className}`}>{t(status)}</span>;
}
