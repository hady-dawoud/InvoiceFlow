"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRequest } from "@/lib/use-request";
import {
  deleteInvoiceAction,
  setInvoiceStatusAction,
} from "@/lib/actions/invoices";
import { allowedTransitions } from "@/lib/invoice";

const NEXT_STATUS_KEY: Record<string, "markSent" | "markPaid" | "revertToDraft"> = {
  sent: "markSent",
  paid: "markPaid",
  draft: "revertToDraft",
};

export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: "draft" | "sent" | "paid";
}) {
  const router = useRouter();
  const t = useTranslations("invoice.actions");
  // Action errors come back as catalog keys (e.g. "invoice.notFound");
  // translate them with an unscoped translator.
  const tError = useTranslations();
  const { run, pending, error, setError } = useRequest();

  function transition(next: "draft" | "sent" | "paid") {
    setError(null);
    void run(async () => {
      const result = await setInvoiceStatusAction(invoiceId, next);
      if (!result.ok) setError(tError(result.error));
      else router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setError(null);
    void run(async () => {
      const result = await deleteInvoiceAction(invoiceId);
      if (!result.ok) setError(tError(result.error));
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
              ? "btn"
              : "btn btn-ghost disabled:opacity-60"
          }
        >
          {t(NEXT_STATUS_KEY[next])}
        </button>
      ))}
      <button
        onClick={remove}
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {t("delete")}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
