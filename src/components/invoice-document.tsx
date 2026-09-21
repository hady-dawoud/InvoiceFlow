import { calcTotals, formatCents } from "@/lib/money";
import type { Client, Invoice, InvoiceItem } from "@/db/schema";
import { StatusBadge } from "@/components/status-badge";

/**
 * Print-friendly invoice document shared by the owner detail page and the
 * public client-facing page. Pure presentation — no actions.
 */
export function InvoiceDocument({
  invoice,
  client,
  items,
  businessName,
  businessEmail,
  currency,
}: {
  invoice: Pick<Invoice, "number" | "status" | "issueDate" | "dueDate" | "taxBps" | "notes">;
  client: Pick<Client, "name" | "email" | "address">;
  items: Pick<InvoiceItem, "description" | "quantity" | "unitPriceCents">[];
  businessName: string;
  businessEmail?: string;
  currency: string;
}) {
  const totals = calcTotals(items, invoice.taxBps);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Invoice
          </p>
          <p className="text-2xl font-bold text-slate-900">{invoice.number}</p>
          <div className="mt-2">
            <StatusBadge status={invoice.status} dueDate={invoice.dueDate} />
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-slate-900">{businessName}</p>
          {businessEmail && <p className="text-slate-500">{businessEmail}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billed to</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{client.name}</p>
          {client.email && <p className="text-sm text-slate-500">{client.email}</p>}
          {client.address && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{client.address}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Issued</p>
          <p className="mt-1 text-sm text-slate-700">{invoice.issueDate}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Due</p>
          <p className="mt-1 text-sm text-slate-700">{invoice.dueDate}</p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-2.5 text-slate-700">{item.description}</td>
              <td className="py-2.5 text-right text-slate-600">{item.quantity}</td>
              <td className="py-2.5 text-right text-slate-600">
                {formatCents(item.unitPriceCents, currency)}
              </td>
              <td className="py-2.5 text-right font-medium text-slate-900">
                {formatCents(item.quantity * item.unitPriceCents, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{formatCents(totals.subtotalCents, currency)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax ({invoice.taxBps / 100}%)</span>
            <span>{formatCents(totals.taxCents, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>Total due</span>
            <span>{formatCents(totals.totalCents, currency)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-8 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
