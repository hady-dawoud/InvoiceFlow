import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { InvoiceActions } from "@/components/invoice-actions";
import { InvoiceDocument } from "@/components/invoice-document";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getSession } from "@/lib/session";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
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
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Invoices
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
          <CopyLinkButton token={invoice.token} />
          {session.user.isPro ? (
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Download PDF
            </a>
          ) : (
            <Link
              href="/pricing"
              className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              title="PDF export is a Pro feature"
            >
              PDF (Pro)
            </Link>
          )}
          <Link
            href={`/dashboard/invoices/${invoice.id}/edit`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
        </div>
      </div>

      <InvoiceDocument
        invoice={invoice}
        client={client}
        items={items}
        businessName={businessName}
        businessEmail={session.user.email}
        currency={session.user.currency}
      />
    </div>
  );
}
