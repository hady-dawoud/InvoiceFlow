"use client";

import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  createInvoiceAction,
  updateInvoiceAction,
} from "@/lib/actions/invoices";
import { calcTotals, formatCents, parseAmountToCents, type Totals } from "@/lib/money";
import { parseInvoiceInput, parseItems } from "@/lib/invoice-validation";
import { useRequest } from "@/lib/use-request";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { InvoiceItemsEditor, EMPTY_ITEM, type EditorItem } from "./invoice-items-editor";

export type EditorInitial = {
  clientId: string;
  issueDate: string;
  dueDate: string;
  taxBps: number;
  notes: string;
  status: "draft" | "sent" | "paid";
  items: EditorItem[];
};

export function InvoiceEditor({
  clients,
  currency,
  invoiceId,
  initial,
}: {
  clients: { id: string; name: string }[];
  currency: string;
  /** Present in edit mode. */
  invoiceId?: string;
  initial: EditorInitial;
}) {
  const router = useRouter();
  const t = useTranslations("invoice.editor");
  // Validation and action errors come back as catalog keys (e.g.
  // "invoice.chooseClient"); translate them with an unscoped translator.
  const tError = useTranslations();
  const [clientId, setClientId] = useState(initial.clientId);
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [taxRate, setTaxRate] = useState(String(initial.taxBps / 100));
  const [notes, setNotes] = useState(initial.notes);
  const [items, setItems] = useState<EditorItem[]>(
    initial.items.length > 0 ? initial.items : [EMPTY_ITEM],
  );
  const { run, pending: requestPending, error, setError } = useRequest();
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [savingStatus, setSavingStatus] = useState<"draft" | "sent" | null>(null);
  const pending = requestPending ? savingStatus : null;
  const parsedPreview = parseItems(JSON.stringify(items));
  const previewItems = Array.isArray(parsedPreview) ? parsedPreview : null;
  const taxBps = parseAmountToCents(taxRate || "0");
  let totals: Totals | null = null;
  if (previewItems && taxBps !== null) {
    try { totals = calcTotals(previewItems, taxBps); }
    catch (error) { if (!(error instanceof RangeError)) throw error; }
  }
  async function handleSubmit(status: "draft" | "sent") {
    setError(null);
    setSavingStatus(status);
    const formData = new FormData();
    formData.set("clientId", clientId);
    formData.set("status", initial.status === "paid" ? "paid" : status);
    formData.set("issueDate", issueDate);
    formData.set("dueDate", dueDate);
    formData.set("taxRate", taxRate);
    formData.set("notes", notes);
    formData.set("itemsJson", JSON.stringify(items));
    const input = parseInvoiceInput(formData);
    if (typeof input === "string") { setError(tError(input)); return; }
    const result = await run(() => invoiceId
      ? updateInvoiceAction(invoiceId, formData)
      : createInvoiceAction(formData));
    if (!result) return;
    if (result.ok) {
      router.push(`/dashboard/invoices/${result.id}`);
      router.refresh();
      return;
    }
    if (result.error === "quota") {
      setQuotaBlocked(true);
      return;
    }
    setError(tError(result.error));
  }
  if (quotaBlocked) {
    return (
      <div className="mx-auto max-w-md bg-sheet p-6 text-center shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <h2 className="display text-2xl">{t("quotaBlocked.heading")}</h2>
        <p className="mt-2 text-sm text-quiet">
          {t("quotaBlocked.usedAll", { limit: FREE_MONTHLY_LIMIT })}{" "}
          {t("quotaBlocked.upgradeNote")}
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block btn"
        >
          {t("quotaBlocked.upgradeCta", { price: PRO_MONTHLY_PRICE_LABEL })}
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="space-y-6"
      data-testid="invoice-editor"
    >
      <fieldset disabled={requestPending} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("fields.client")}>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="field"
            required
          >
            <option value="" disabled>
              {t("selectClientPlaceholder")}
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("fields.issueDate")}>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="field"
            required
          />
        </Field>
        <Field label={t("fields.dueDate")}>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="field"
            required
          />
        </Field>
      </div>
      <InvoiceItemsEditor items={items} setItems={setItems} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <Field label={t("fields.taxRate")}>
            <input
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              inputMode="decimal"
              placeholder={t("taxRatePlaceholder")}
              className="w-32 field"
            />
          </Field>
          <Field label={t("fields.notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("notesPlaceholder")}
              className="field"
            />
          </Field>
        </div>
        <div className="ms-auto w-full max-w-xs space-y-1.5 self-start rounded-xl border border-line bg-white p-4 text-sm">
          <Row label={t("summary.subtotal")} value={totals ? formatCents(totals.subtotalCents, currency) : "—"} />
          <Row label={t("summary.tax")} value={totals ? formatCents(totals.taxCents, currency) : "—"} />
          <div className="border-t border-paper pt-1.5">
            <Row label={t("summary.total")} value={totals ? formatCents(totals.totalCents, currency) : "—"} strong />
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={requestPending}
          onClick={() => handleSubmit("sent")}
          className="btn"
        >
          {pending === "sent" ? t("saving") : t("saveSent")}
        </button>
        <button
          type="button"
          disabled={requestPending}
          onClick={() => handleSubmit("draft")}
          className="btn btn-ghost"
        >
          {pending === "draft" ? t("saving") : t("saveDraft")}
        </button>
        <Link href="/dashboard/invoices" className="text-sm text-quiet hover:underline">
          {t("cancel")}
        </Link>
      </div>
      </fieldset>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={strong ? "font-semibold text-ink" : "text-quiet"}>{label}</span>
      <span className={strong ? "font-semibold text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}
