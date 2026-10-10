import { getTranslations } from "next-intl/server";
import { calcTotals, formatCents } from "@/lib/money";
import type { Client, Invoice, InvoiceItem } from "@/db/schema";
import { StatusBadge } from "@/components/status-badge";

/**
 * Print-friendly invoice document shared by the owner detail page and the
 * public client-facing page. Pure presentation — no actions.
 *
 * Labels come from the `invoice.document` catalog keys under the current UI
 * locale. A later task gives the sheet its own document locale and direction;
 * this component does not set `dir` itself.
 */
export async function InvoiceDocument({
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
  const t = await getTranslations("invoice.document");

  return (
    <div className="sheet print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="display italic">{t("label")}</p>
          <p className="display money text-3xl">{invoice.number}</p>
          <div className="mt-2">
            <StatusBadge status={invoice.status} dueDate={invoice.dueDate} />
          </div>
        </div>
        <div className="text-end text-sm">
          <p className="font-semibold text-ink">{businessName}</p>
          {businessEmail && <p className="text-quiet">{businessEmail}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-quiet">{t("billedTo")}</p>
          <p className="mt-1 text-sm font-medium text-ink">{client.name}</p>
          {client.email && <p className="text-sm text-quiet">{client.email}</p>}
          {client.address && <p className="mt-1 whitespace-pre-line text-sm text-quiet">{client.address}</p>}
        </div>
        <div>
          <p className="text-quiet">{t("issued")}</p>
          <p className="mt-1 text-sm text-ink">{invoice.issueDate}</p>
        </div>
        <div>
          <p className="text-quiet">{t("due")}</p>
          <p className="mt-1 text-sm text-ink">{invoice.dueDate}</p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead className="border-b border-paper text-start text-sm text-quiet">
          <tr>
            <th className="py-2 font-medium">{t("table.description")}</th>
            <th className="py-2 text-end font-medium">{t("table.qty")}</th>
            <th className="py-2 text-end font-medium">{t("table.unitPrice")}</th>
            <th className="py-2 text-end font-medium">{t("table.amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-2.5 text-ink">{item.description}</td>
              <td className="py-2.5 text-end text-quiet">{item.quantity}</td>
              <td className="py-2.5 text-end text-quiet">
                {formatCents(item.unitPriceCents, currency)}
              </td>
              <td className="py-2.5 text-end font-medium text-ink">
                {formatCents(item.quantity * item.unitPriceCents, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-quiet">
            <span>{t("subtotal")}</span>
            <span>{formatCents(totals.subtotalCents, currency)}</span>
          </div>
          <div className="flex justify-between text-quiet">
            <span>{t("taxLabel", { pct: invoice.taxBps / 100 })}</span>
            <span>{formatCents(totals.taxCents, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
            <span>{t("totalDue")}</span>
            <span>{formatCents(totals.totalCents, currency)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="mt-8 border-t border-paper pt-4">
          <p className="text-quiet">{t("notes")}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-quiet">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
