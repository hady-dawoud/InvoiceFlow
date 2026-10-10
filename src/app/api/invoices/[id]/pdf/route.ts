import { createTranslator } from "next-intl";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { invoicePdfDisposition, renderInvoicePdf, type PdfLabels } from "@/lib/invoice-pdf";
import { getSession } from "@/lib/session";
import arMessages from "../../../../../../messages/ar.json";
import enMessages from "../../../../../../messages/en.json";

export const runtime = "nodejs";

const catalogs = { en: enMessages, ar: arMessages } as const;

function pdfLabels(locale: "en" | "ar", taxBps: number): PdfLabels {
  const t = createTranslator({
    locale,
    messages: catalogs[locale],
    namespace: "invoice.document",
  });
  return {
    title: t("label"),
    billedTo: t("billedTo"),
    issued: t("issued"),
    due: t("due"),
    description: t("table.description"),
    qty: t("table.qty"),
    unitPrice: t("table.unitPrice"),
    amount: t("table.amount"),
    subtotal: t("subtotal"),
    tax: t("taxLabel", { pct: taxBps / 100 }),
    totalDue: t("totalDue"),
    notes: t("notes"),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const { id } = await params;
  const detail = await getInvoiceDetail(session.user.id, id);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  if (!session.user.isPro) {
    return Response.json({ error: "upgrade required" }, { status: 402 });
  }

  const documentLocale = detail.invoice.documentLocale === "ar" ? "ar" : "en";
  const pdf = await renderInvoicePdf(
    detail,
    {
      businessName: session.user.businessName ?? session.user.name,
      email: session.user.email,
      currency: session.user.currency,
    },
    pdfLabels(documentLocale, detail.invoice.taxBps),
    documentLocale,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": invoicePdfDisposition(detail.invoice.number),
    },
  });
}
