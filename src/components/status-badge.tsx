import { STATUS_META } from "@/lib/invoice";
import { isOverdue } from "@/lib/invoice";

export function StatusBadge({
  status,
  dueDate,
}: {
  status: "draft" | "sent" | "paid";
  dueDate?: string;
}) {
  if (status === "sent" && dueDate && isOverdue({ status, dueDate })) {
    return <span className="stamp stamp-overdue">Overdue</span>;
  }
  const meta = STATUS_META[status];
  return <span className={`stamp ${meta.className}`}>{meta.label}</span>;
}
