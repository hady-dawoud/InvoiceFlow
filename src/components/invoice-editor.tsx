"use client";

import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const previewItems = parseItems(JSON.stringify(items));
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
    if (typeof input === "string") { setError(input); return; }
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
    setError(result.error);
  }
  if (quotaBlocked) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Free plan limit reached</h2>
        <p className="mt-2 text-sm text-amber-800">
          You&apos;ve used all {FREE_MONTHLY_LIMIT} free invoices this month. Upgrade to Pro for
          unlimited invoices, PDF export and payment tracking.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Upgrade to Pro — {PRO_MONTHLY_PRICE_LABEL}/mo
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
        <Field label="Client">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            required
          >
            <option value="" disabled>
              Select a client…
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Issue date">
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            required
          />
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            required
          />
        </Field>
      </div>
      <InvoiceItemsEditor items={items} setItems={setItems} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <Field label="Tax rate % (optional)">
            <input
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 8.5"
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment details, thank-you note…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </Field>
        </div>
        <div className="ml-auto w-full max-w-xs space-y-1.5 self-start rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <Row label="Subtotal" value={totals ? formatCents(totals.subtotalCents, currency) : "—"} />
          <Row label="Tax" value={totals ? formatCents(totals.taxCents, currency) : "—"} />
          <div className="border-t border-slate-100 pt-1.5">
            <Row label="Total" value={totals ? formatCents(totals.totalCents, currency) : "—"} strong />
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
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending === "sent" ? "Saving…" : "Save & mark as sent"}
        </button>
        <button
          type="button"
          disabled={requestPending}
          onClick={() => handleSubmit("draft")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending === "draft" ? "Saving…" : "Save as draft"}
        </button>
        <Link href="/dashboard/invoices" className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
      </fieldset>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={strong ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
      <span className={strong ? "font-semibold text-slate-900" : "text-slate-700"}>{value}</span>
    </div>
  );
}
