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
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        Overdue
      </span>
    );
  }
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}
