import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CopyLinkButton } from "@/components/copy-link-button";
import { InvoiceActions } from "@/components/invoice-actions";
import { InvoiceDocument } from "@/components/invoice-document";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invoice.detail");
  return { title: t("metaTitle") };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const t = await getTranslations("invoice.detail");
  const { id } = await params;
  const detail = await getInvoiceDetail(session.user.id, id);
  if (!detail) notFound();

  const { invoice, client, items } = detail;
  const businessName = session.user.businessName ?? session.user.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center gap-1 text-sm text-quiet hover:text-ink"
        >
          <span aria-hidden="true" className="rtl:rotate-180">
            ←
          </span>
          {t("back")}
        </Link>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
          <CopyLinkButton token={invoice.token} />
          {session.user.isPro ? (
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="btn btn-ghost"
            >
              {t("downloadPdf")}
            </a>
          ) : (
            <Link
              href="/pricing"
              className="rounded-lg border border-dashed border-carbon bg-sheet px-3 py-1.5 text-sm font-medium text-carbon hover:bg-ink/8"
              title={t("pdfProTitle")}
            >
              {t("pdfProLabel")}
            </Link>
          )}
          <Link
            href={`/dashboard/invoices/${invoice.id}/edit`}
            className="btn btn-ghost"
          >
            {t("edit")}
          </Link>
        </div>
      </div>

      <InvoiceDocument
        invoice={invoice}
        client={client}
        items={items}
        businessName={businessName}
        businessEmail={session.user.email}
        taxId={session.user.taxId}
        paymentInstructions={session.user.paymentInstructions}
        currency={invoice.currency}
      />
    </div>
  );
}
