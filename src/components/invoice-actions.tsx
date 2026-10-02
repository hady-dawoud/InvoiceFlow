"use client";

import { useRouter } from "next/navigation";
import { useRequest } from "@/lib/use-request";
import {
  deleteInvoiceAction,
  setInvoiceStatusAction,
} from "@/lib/actions/invoices";
import { allowedTransitions, STATUS_META } from "@/lib/invoice";

const NEXT_STATUS_LABEL: Record<string, string> = {
  sent: "Mark as sent",
  paid: "Mark as paid",
  draft: "Revert to draft",
};

export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: "draft" | "sent" | "paid";
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useRequest();

  function transition(next: "draft" | "sent" | "paid") {
    setError(null);
    void run(async () => {
      const result = await setInvoiceStatusAction(invoiceId, next);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Delete this invoice? This cannot be undone.")) return;
    setError(null);
    void run(async () => {
      const result = await deleteInvoiceAction(invoiceId);
      if (!result.ok) setError(result.error);
      else {
        router.push("/dashboard/invoices");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowedTransitions(status).map((next) => (
        <button
          key={next}
          onClick={() => transition(next)}
          disabled={pending}
          className={
            next === "paid"
              ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              : "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          }
        >
          {NEXT_STATUS_LABEL[next] ?? STATUS_META[next].label}
        </button>
      ))}
      <button
        onClick={remove}
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Delete
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
