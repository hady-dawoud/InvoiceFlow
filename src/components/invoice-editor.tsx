"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createInvoiceAction,
  updateInvoiceAction,
} from "@/lib/actions/invoices";
import { calcTotals, formatCents, parseAmountToCents } from "@/lib/money";

export type EditorItem = { description: string; quantity: string; price: string };

export type EditorInitial = {
  clientId: string;
  issueDate: string;
  dueDate: string;
  taxBps: number;
  notes: string;
  status: "draft" | "sent" | "paid";
  items: EditorItem[];
};

const EMPTY_ITEM: EditorItem = { description: "", quantity: "1", price: "" };

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
  const [error, setError] = useState<string | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [pending, setPending] = useState<"draft" | "sent" | null>(null);

  const parsed = items.map((item) => ({
    description: item.description,
    quantity: Number.parseInt(item.quantity, 10),
    unitPriceCents: parseAmountToCents(item.price),
  }));
  const validItems = parsed.filter(
    (item) =>
      item.description.trim().length > 0 &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.unitPriceCents !== null,
  ) as { description: string; quantity: number; unitPriceCents: number }[];
  const totals = calcTotals(validItems, Math.round(Number(taxRate || 0) * 100));

  function setItem(index: number, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(status: "draft" | "sent") {
    setError(null);
    setPending(status);

    const formData = new FormData();
    formData.set("clientId", clientId);
    formData.set("status", initial.status === "paid" ? "paid" : status);
    formData.set("issueDate", issueDate);
    formData.set("dueDate", dueDate);
    formData.set("taxRate", taxRate);
    formData.set("notes", notes);
    formData.set("itemsJson", JSON.stringify(items));

    const result = invoiceId
      ? await updateInvoiceAction(invoiceId, formData)
      : await createInvoiceAction(formData);

    setPending(null);
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
          You&apos;ve used all 3 free invoices this month. Upgrade to Pro for
          unlimited invoices, PDF export and payment tracking.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Upgrade to Pro — $9/mo
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

      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 font-medium">Qty</th>
              <th className="w-32 px-3 py-2 font-medium">Price</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <input
                    value={item.description}
                    onChange={(e) => setItem(index, { description: e.target.value })}
                    placeholder="Design work, consulting…"
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setItem(index, { quantity: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.price}
                    onChange={(e) => setItem(index, { price: e.target.value })}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.length > 1 ? prev.filter((_, i) => i !== index) : [EMPTY_ITEM],
                      )
                    }
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, EMPTY_ITEM])}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            + Add line item
          </button>
        </div>
      </div>

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
          <Row label="Subtotal" value={formatCents(totals.subtotalCents, currency)} />
          <Row label="Tax" value={formatCents(totals.taxCents, currency)} />
          <div className="border-t border-slate-100 pt-1.5">
            <Row label="Total" value={formatCents(totals.totalCents, currency)} strong />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => handleSubmit("sent")}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending === "sent" ? "Saving…" : "Save & mark as sent"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => handleSubmit("draft")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending === "draft" ? "Saving…" : "Save as draft"}
        </button>
        <Link href="/dashboard/invoices" className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
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
