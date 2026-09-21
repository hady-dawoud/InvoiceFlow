import PDFDocument from "pdfkit";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { calcTotals, formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";
import type { Session } from "@/lib/auth";

export const runtime = "nodejs";

function drawHeader(
  doc: PDFKit.PDFDocument,
  detail: NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>,
  session: Session,
  left: number,
  right: number,
) {
  const { invoice, client } = detail;
  const businessName = session.user.businessName ?? session.user.name;

  doc.fontSize(22).font("Helvetica-Bold").text("INVOICE", left, 50);
  doc.fontSize(10).font("Helvetica").fillColor("#555");
  doc.text(invoice.number, left, 74);
  doc.font("Helvetica-Bold").fillColor("#111").text(businessName, right - 200, 50, { width: 200, align: "right" });
  doc.font("Helvetica").fillColor("#555").text(session.user.email, right - 200, 66, { width: 200, align: "right" });

  doc.fillColor("#111").font("Helvetica-Bold").text("Billed to", left, 120);
  doc.font("Helvetica").fillColor("#555");
  doc.text(client.name, left, 136);
  if (client.email) doc.text(client.email);
  if (client.address) doc.text(client.address, { width: 220 });

  doc.font("Helvetica-Bold").fillColor("#111").text("Issued", 300, 120);
  doc.font("Helvetica").fillColor("#555").text(invoice.issueDate, 300, 136);
  doc.font("Helvetica-Bold").fillColor("#111").text("Due", 420, 120);
  doc.font("Helvetica").fillColor("#555").text(invoice.dueDate, 420, 136);
}

function drawItemTable(
  doc: PDFKit.PDFDocument,
  items: { description: string; quantity: number; unitPriceCents: number }[],
  currency: string,
  left: number,
  right: number,
): number {
  let y = 190;
  doc.rect(left, y, right - left, 20).fill("#f1f5f9");
  doc.fillColor("#334155").font("Helvetica-Bold").fontSize(9);
  doc.text("DESCRIPTION", left + 8, y + 6);
  doc.text("QTY", 380, y + 6, { width: 40, align: "right" });
  doc.text("UNIT PRICE", 440, y + 6, { width: 60, align: "right" });
  doc.text("AMOUNT", right - 68, y + 6, { width: 60, align: "right" });

  y += 20;
  doc.font("Helvetica").fontSize(10);
  for (const item of items) {
    doc.fillColor("#111");
    doc.text(item.description, left + 8, y + 6, { width: 290, ellipsis: true });
    doc.fillColor("#555");
    doc.text(String(item.quantity), 380, y + 6, { width: 40, align: "right" });
    doc.text(formatCents(item.unitPriceCents, currency), 440, y + 6, { width: 60, align: "right" });
    doc.fillColor("#111");
    doc.text(formatCents(item.quantity * item.unitPriceCents, currency), right - 68, y + 6, { width: 60, align: "right" });
    y += 22;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
  }
  return y;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  totals: { subtotalCents: number; taxCents: number; totalCents: number },
  taxBps: number,
  currency: string,
  right: number,
  y: number,
) {
  doc.font("Helvetica").fillColor("#555");
  doc.text("Subtotal", 440, y, { width: 60, align: "right" });
  doc.fillColor("#111").text(formatCents(totals.subtotalCents, currency), right - 128, y, { width: 120, align: "right" });
  doc.fillColor("#555");
  doc.text(`Tax (${taxBps / 100}%)`, 440, y + 16, { width: 60, align: "right" });
  doc.fillColor("#111").text(formatCents(totals.taxCents, currency), right - 128, y + 16, { width: 120, align: "right" });
  doc.font("Helvetica-Bold").fontSize(11);
  doc.fillColor("#111");
  doc.text("Total due", 440, y + 36, { width: 60, align: "right" });
  doc.text(formatCents(totals.totalCents, currency), right - 128, y + 36, { width: 120, align: "right" });
}

function drawInvoice(
  doc: PDFKit.PDFDocument,
  detail: NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>,
  session: Session,
) {
  const { invoice, client, items } = detail;
  const currency = session.user.currency;
  const left = 50;
  const right = 545;

  drawHeader(doc, detail, session, left, right);
  const tableEnd = drawItemTable(doc, items, currency, left, right);

  const totals = calcTotals(items, invoice.taxBps);
  drawTotals(doc, totals, invoice.taxBps, currency, right, tableEnd + 12);

  if (invoice.notes) {
    const y = tableEnd + 76;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text("NOTES", left, y);
    doc.font("Helvetica").fontSize(10).fillColor("#555").text(invoice.notes, left, y + 14, { width: right - left });
  }

  doc.fontSize(8).fillColor("#94a3b8").text("Created with InvoiceFlow", left, 780, { align: "center", width: right - left });
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

  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  drawInvoice(doc, detail, session);
  doc.end();

  const pdf = await done;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.invoice.number}.pdf"`,
    },
  });
}
