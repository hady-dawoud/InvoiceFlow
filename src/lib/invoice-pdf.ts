import PDFDocument from "pdfkit";
import { calcTotals, formatCents } from "@/lib/money";
import type { InvoiceInput } from "@/lib/data/invoices";

export type PdfInvoice = {
  invoice: { number: string; issueDate: string; dueDate: string; taxBps: number; notes: string | null };
  client: { name: string; email: string | null; address: string | null };
  items: InvoiceInput["items"];
};
export type PdfOwner = { businessName: string; email: string; currency: string };

type Column = { text: string; x: number; width: number; right?: boolean; numeric?: boolean };
const LEFT = 50;
const RIGHT = 562;
const CONTENT_BOTTOM = 720;
const LINE_HEIGHT = 14;

function wrapText(doc: PDFKit.PDFDocument, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const character of paragraph) {
      if (line && doc.widthOfString(line + character) > width) {
        const space = line.lastIndexOf(" ");
        lines.push(space > 0 ? line.slice(0, space) : line);
        line = space > 0 ? line.slice(space + 1) : "";
      }
      line += character;
    }
    lines.push(line);
  }
  return lines;
}

class InvoicePdfRenderer {
  private y = 50;
  constructor(private doc: PDFKit.PDFDocument, private detail: PdfInvoice, private owner: PdfOwner) {}

  private footer() {
    this.doc.font("Helvetica").fontSize(8).fillColor("#94a3b8")
      .text("Created with InvoiceFlow", 252, 750, { lineBreak: false });
  }

  private newPage(table: boolean) {
    this.footer();
    this.doc.addPage();
    this.doc.font("Helvetica").fontSize(10).fillColor("#555")
      .text(`${this.detail.invoice.number} (continued)`, LEFT, 50, { lineBreak: false });
    this.y = 78;
    if (table) this.tableHeading();
  }

  private ensureSpace(height: number, table = false) {
    if (this.y + height > CONTENT_BOTTOM) this.newPage(table);
  }

  private columns(columns: Column[], table = false) {
    const sizes = columns.map((column) => {
      this.doc.fontSize(10);
      return column.numeric ? Math.min(10, column.width / this.doc.widthOfString(column.text) * 9.8) : 10;
    });
    const lines = columns.map((column, i) => wrapText(this.doc.fontSize(sizes[i]), column.text, column.width));
    const count = Math.max(...lines.map((column) => column.length));
    const height = count * LINE_HEIGHT;
    if (height < CONTENT_BOTTOM - 110) this.ensureSpace(height + 12, table);
    for (let i = 0; i < count; i++) {
      this.ensureSpace(LINE_HEIGHT, table);
      columns.forEach((column, index) => {
        this.doc.fontSize(sizes[index]);
        const text = lines[index][i] ?? "";
        const x = column.right ? column.x + column.width - this.doc.widthOfString(text) : column.x;
        this.doc.text(text, x, this.y, { lineBreak: false });
      });
      this.y += LINE_HEIGHT;
    }
  }

  private header() {
    this.doc.font("Helvetica-Bold").fontSize(22).fillColor("#111")
      .text("INVOICE", LEFT, this.y, { lineBreak: false });
    this.y += 32;
    this.doc.font("Helvetica").fontSize(10).fillColor("#555");
    this.columns([
      { text: this.detail.invoice.number, x: LEFT, width: 240 },
      { text: `${this.owner.businessName}\n${this.owner.email}`, x: 322, width: 240, right: true },
    ]);
    this.y += 24;
    const { client, invoice } = this.detail;
    this.columns([
      { text: ["Billed to", client.name, client.email, client.address].filter(Boolean).join("\n"), x: LEFT, width: 240 },
      { text: `Issued: ${invoice.issueDate}\nDue: ${invoice.dueDate}`, x: 322, width: 240, right: true },
    ]);
    this.y += 22;
  }

  private tableHeading() {
    this.ensureSpace(28);
    this.doc.rect(LEFT, this.y - 4, RIGHT - LEFT, 24).fill("#f1f5f9");
    this.doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155");
    this.columns([
      { text: "DESCRIPTION", x: LEFT + 6, width: 204 },
      { text: "QTY", x: 272, width: 64, right: true },
      { text: "UNIT PRICE", x: 344, width: 98, right: true },
      { text: "AMOUNT", x: 450, width: 106, right: true },
    ]);
    this.y += 12;
    this.doc.font("Helvetica").fontSize(10).fillColor("#111");
  }

  private items() {
    this.tableHeading();
    for (const item of this.detail.items) {
      this.ensureSpace(26, true);
      this.columns([
        { text: item.description, x: LEFT + 6, width: 204 },
        { text: String(item.quantity), x: 272, width: 64, right: true, numeric: true },
        { text: formatCents(item.unitPriceCents, this.owner.currency), x: 344, width: 98, right: true, numeric: true },
        { text: formatCents(item.quantity * item.unitPriceCents, this.owner.currency), x: 450, width: 106, right: true, numeric: true },
      ], true);
      this.y += 10;
      this.doc.moveTo(LEFT, this.y - 4).lineTo(RIGHT, this.y - 4).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
    }
  }

  private totals() {
    this.ensureSpace(90);
    this.y += 18;
    const totals = calcTotals(this.detail.items, this.detail.invoice.taxBps);
    this.doc.font("Helvetica").fontSize(10).fillColor("#555");
    this.columns([
      { text: `Subtotal\nTax (${this.detail.invoice.taxBps / 100}%)\nTotal due`, x: 322, width: 112 },
      { text: [totals.subtotalCents, totals.taxCents, totals.totalCents].map((value) => formatCents(value, this.owner.currency)).join("\n"), x: 442, width: 120, right: true },
    ]);
    this.y += 22;
  }

  draw() {
    this.header();
    this.items();
    this.totals();
    if (this.detail.invoice.notes) {
      this.doc.font("Helvetica").fontSize(10).fillColor("#555");
      this.columns([{ text: `NOTES\n${this.detail.invoice.notes}`, x: LEFT, width: RIGHT - LEFT }]);
    }
    this.footer();
  }
}

export function collectPdfStream(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.once("error", reject);
    doc.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

export function invoicePdfDisposition(number: string) {
  const safe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/.test(number) ? number : "invoice";
  return `attachment; filename="${safe}.pdf"`;
}

export function renderInvoicePdf(detail: PdfInvoice, owner: PdfOwner): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const done = collectPdfStream(doc);
  try {
    new InvoicePdfRenderer(doc, detail, owner).draw();
    doc.end();
  } catch (error) {
    doc.destroy(error instanceof Error ? error : new Error(String(error)));
  }
  return done;
}
