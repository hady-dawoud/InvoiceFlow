import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InvoiceEditor } from "@/components/invoice-editor";
import { listClientOptions } from "@/lib/data/clients";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getSession } from "@/lib/session";
import { centsToDecimal } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invoice.edit");
  return { title: t("metaTitle") };
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const t = await getTranslations("invoice.edit");
  const { id } = await params;
  const [detail, clientOptions] = await Promise.all([
    getInvoiceDetail(session.user.id, id),
    listClientOptions(session.user.id),
  ]);
  if (!detail) notFound();

  const { invoice, items } = detail;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-ink">{t("heading", { number: invoice.number })}</h1>
      <InvoiceEditor
        clients={clientOptions}
        currency={session.user.currency}
        invoiceId={invoice.id}
        initial={{
          clientId: invoice.clientId,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          taxBps: invoice.taxBps,
          notes: invoice.notes ?? "",
          status: invoice.status,
          documentLocale: invoice.documentLocale === "ar" ? "ar" : "en",
          items: items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            price: centsToDecimal(item.unitPriceCents),
          })),
        }}
      />
    </div>
  );
}
