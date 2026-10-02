import { getInvoiceDetail } from "@/lib/data/invoices";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

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

  const pdf = await renderInvoicePdf(detail, {
    businessName: session.user.businessName ?? session.user.name,
    email: session.user.email,
    currency: session.user.currency,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.invoice.number}.pdf"`,
    },
  });
}
