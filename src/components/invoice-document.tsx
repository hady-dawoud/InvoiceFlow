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
    <div className="sheet print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="display italic">Invoice</p>
          <p className="display money text-3xl">{invoice.number}</p>
          <div className="mt-2">
            <StatusBadge status={invoice.status} dueDate={invoice.dueDate} />
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-ink">{businessName}</p>
          {businessEmail && <p className="text-quiet">{businessEmail}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-quiet">Billed to</p>
          <p className="mt-1 text-sm font-medium text-ink">{client.name}</p>
          {client.email && <p className="text-sm text-quiet">{client.email}</p>}
          {client.address && <p className="mt-1 whitespace-pre-line text-sm text-quiet">{client.address}</p>}
        </div>
        <div>
          <p className="text-quiet">Issued</p>
          <p className="mt-1 text-sm text-ink">{invoice.issueDate}</p>
        </div>
        <div>
          <p className="text-quiet">Due</p>
          <p className="mt-1 text-sm text-ink">{invoice.dueDate}</p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead className="border-b border-paper text-left text-sm text-quiet">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-2.5 text-ink">{item.description}</td>
              <td className="py-2.5 text-right text-quiet">{item.quantity}</td>
              <td className="py-2.5 text-right text-quiet">
                {formatCents(item.unitPriceCents, currency)}
              </td>
              <td className="py-2.5 text-right font-medium text-ink">
                {formatCents(item.quantity * item.unitPriceCents, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-quiet">
            <span>Subtotal</span>
            <span>{formatCents(totals.subtotalCents, currency)}</span>
          </div>
          <div className="flex justify-between text-quiet">
            <span>Tax ({invoice.taxBps / 100}%)</span>
            <span>{formatCents(totals.taxCents, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
            <span>Total due</span>
            <span>{formatCents(totals.totalCents, currency)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-8 border-t border-paper pt-4">
          <p className="text-quiet">Notes</p>
          <p className="mt-1 whitespace-pre-line text-sm text-quiet">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
