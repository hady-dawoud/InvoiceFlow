import { createTranslator } from "next-intl";
import { calcTotals, formatCents } from "@/lib/money";
import { textDirection } from "@/lib/text-direction";
import type { Client, Invoice, InvoiceItem } from "@/db/schema";
import { StatusBadge } from "@/components/status-badge";
import enMessages from "../../messages/en.json";
import arMessages from "../../messages/ar.json";

const catalogs = { en: enMessages, ar: arMessages } as const;

type DocumentLocale = "en" | "ar";

function documentDir(locale: DocumentLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function LtrBdi({ value }: { value: string }) {
  return <bdi dir="ltr">{value}</bdi>;
}

function StoredBdi({ value }: { value: string }) {
  return <bdi dir={textDirection(value)}>{value}</bdi>;
}

function notesAlignClass(paragraph: string, locale: DocumentLocale): "text-start" | "text-end" {
  const sheetDir = documentDir(locale);
  const hasLetter = /\p{L}/u.test(paragraph);
  const alignDir = hasLetter ? textDirection(paragraph) : sheetDir;
  return alignDir === sheetDir ? "text-start" : "text-end";
}

function paragraphs(value: string): string[] {
  return value.split(/\r?\n/);
}

function labeledParagraphs(label: string, value: string, locale: DocumentLocale) {
  return (
    <div className="mt-8 border-t border-paper pt-4">
      <p className="text-quiet">{label}</p>
      {paragraphs(value).map((paragraph, index) => (
        <p
          key={index}
          className={`mt-1 whitespace-pre-line text-sm text-quiet ${notesAlignClass(paragraph, locale)}`}
        >
          <StoredBdi value={paragraph} />
        </p>
      ))}
    </div>
  );
}

/**
 * Print-friendly invoice document shared by the owner detail page and the
 * public client-facing page. Pure presentation — no actions.
 *
 * Labels follow `invoice.documentLocale`, not the surrounding UI locale.
 */
export function InvoiceDocument({
  invoice,
  client,
  items,
  businessName,
  businessEmail,
  taxId,
  paymentInstructions,
  currency,
}: {
  invoice: Pick<
    Invoice,
    "number" | "status" | "issueDate" | "dueDate" | "taxBps" | "notes" | "documentLocale"
  >;
  client: Pick<Client, "name" | "email" | "address">;
  items: Pick<InvoiceItem, "description" | "quantity" | "unitPriceCents">[];
  businessName: string;
  businessEmail?: string;
  taxId?: string | null;
  paymentInstructions?: string | null;
  currency: string;
}) {
  const totals = calcTotals(items, invoice.taxBps);
  const locale: DocumentLocale = invoice.documentLocale === "ar" ? "ar" : "en";
  const t = createTranslator({
    locale,
    messages: catalogs[locale],
    namespace: "invoice.document",
  });
  const dir = documentDir(locale);

  return (
    <div className="sheet print:shadow-none" lang={locale} dir={dir}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="display italic">{t("label")}</p>
          <p className="display money text-3xl">
            <LtrBdi value={invoice.number} />
          </p>
          <div className="mt-2">
            <StatusBadge status={invoice.status} dueDate={invoice.dueDate} locale={locale} />
          </div>
        </div>
        <div className="text-end text-sm">
          <p className="font-semibold text-ink">
            <StoredBdi value={businessName} />
          </p>
          {businessEmail && (
            <p className="text-quiet">
              <StoredBdi value={businessEmail} />
            </p>
          )}
          {taxId && (
            <p className="text-quiet">
              {t("taxId")} <LtrBdi value={taxId} />
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-quiet">{t("billedTo")}</p>
          <p className="mt-1 text-sm font-medium text-ink">
            <StoredBdi value={client.name} />
          </p>
          {client.email && (
            <p className="text-sm text-quiet">
              <StoredBdi value={client.email} />
            </p>
          )}
          {client.address &&
            paragraphs(client.address).map((paragraph, index) => (
              <p key={index} className="mt-1 whitespace-pre-line text-sm text-quiet">
                <StoredBdi value={paragraph} />
              </p>
            ))}
        </div>
        <div>
          <p className="text-quiet">{t("issued")}</p>
          <p className="mt-1 text-sm text-ink">
            <LtrBdi value={invoice.issueDate} />
          </p>
        </div>
        <div>
          <p className="text-quiet">{t("due")}</p>
          <p className="mt-1 text-sm text-ink">
            <LtrBdi value={invoice.dueDate} />
          </p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead className="border-b border-paper text-start text-sm text-quiet">
          <tr>
            <th className="py-2 text-start font-medium">{t("table.description")}</th>
            <th className="py-2 text-end font-medium">{t("table.qty")}</th>
            <th className="py-2 text-end font-medium">{t("table.unitPrice")}</th>
            <th className="py-2 text-end font-medium">{t("table.amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-2.5 text-start text-ink">
                <StoredBdi value={item.description} />
              </td>
              <td className="py-2.5 text-end text-quiet">
                <LtrBdi value={String(item.quantity)} />
              </td>
              <td className="py-2.5 text-end text-quiet">
                <LtrBdi value={formatCents(item.unitPriceCents, currency)} />
              </td>
              <td className="py-2.5 text-end font-medium text-ink">
                <LtrBdi value={formatCents(item.quantity * item.unitPriceCents, currency)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-quiet">
            <span>{t("subtotal")}</span>
            <LtrBdi value={formatCents(totals.subtotalCents, currency)} />
          </div>
          <div className="flex justify-between text-quiet">
            <span>
              {t.rich("taxLabel", {
                pct: invoice.taxBps / 100,
                rate: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
              })}
            </span>
            <LtrBdi value={formatCents(totals.taxCents, currency)} />
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
            <span>{t("totalDue")}</span>
            <LtrBdi value={formatCents(totals.totalCents, currency)} />
          </div>
        </div>
      </div>

      {invoice.notes && labeledParagraphs(t("notes"), invoice.notes, locale)}
      {paymentInstructions && labeledParagraphs(t("howToPay"), paymentInstructions, locale)}
    </div>
  );
}
