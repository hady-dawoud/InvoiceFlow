import path from "node:path";
import { expect, it } from "vitest";
import PDFDocument from "pdfkit";
import {
  collectPdfStream,
  invoicePdfDisposition,
  naskhFontPaths,
  renderInvoicePdf,
  type PdfInvoice,
  type PdfLabels,
} from "./invoice-pdf";

const owner = { businessName: "Example Studio", email: "owner@example.com", currency: "usd" };

const enLabels: PdfLabels = {
  title: "INVOICE",
  billedTo: "Billed to",
  issued: "Issued",
  due: "Due",
  description: "DESCRIPTION",
  qty: "QTY",
  unitPrice: "UNIT PRICE",
  amount: "AMOUNT",
  subtotal: "Subtotal",
  tax: "Tax (8.5%)",
  totalDue: "Total due",
  notes: "NOTES",
  footer: "Created with InvoiceFlow",
  continued: "(continued)",
};

const arLabels: PdfLabels = {
  title: "فاتورة",
  billedTo: "موجَّهة إلى",
  issued: "تاريخ الإصدار",
  due: "تاريخ الاستحقاق",
  description: "الوصف",
  qty: "الكمية",
  unitPrice: "سعر الوحدة",
  amount: "المبلغ",
  subtotal: "الإجمالي الفرعي",
  tax: "الضريبة (8.5%)",
  totalDue: "الإجمالي المستحق",
  notes: "ملاحظات",
  footer: "أُنشئت باستخدام InvoiceFlow",
  continued: "(يتبع)",
};

function pdfFixture(count: number, clientName = "Example Client"): PdfInvoice {
  return {
    invoice: { number: "INV-2026-0001", issueDate: "2026-10-01", dueDate: "2026-10-31", taxBps: 850, notes: "Thank you for your business." },
    client: { name: clientName, email: "client@example.com", address: "10 Main Street" },
    items: Array.from({ length: count }, (_, index) => ({ description: `Service ${index + 1}`, quantity: 2, unitPriceCents: 10000 })),
  };
}

it.each([[1, 1], [30, 2]])("renders %i line items in %i pages", async (count, pages) => {
  const buffer = await renderInvoicePdf(pdfFixture(count), owner, enLabels, "en");
  expect(buffer.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(pages);
});

it("rejects drawing errors rather than leaving the PDF response pending", async () => {
  await expect(renderInvoicePdf(pdfFixture(1), { ...owner, currency: "invalid" }, enLabels, "en")).rejects.toThrow();
});

it("keeps the download name inside the content-disposition header", () => {
  expect(invoicePdfDisposition("INV-2026-0001")).toBe('attachment; filename="INV-2026-0001.pdf"');
  expect(invoicePdfDisposition('INV"\r\nX-Evil: 1')).toBe('attachment; filename="invoice.pdf"');
});

it("rejects PDF stream errors", async () => {
  const doc = new PDFDocument();
  const result = collectPdfStream(doc);
  doc.destroy(new Error("PDF stream failure"));
  await expect(result).rejects.toThrow("PDF stream failure");
});

it("does not embed Naskh in an English document with no Arabic", async () => {
  const buffer = await renderInvoicePdf(pdfFixture(1), owner, enLabels, "en");
  expect(buffer.toString("latin1")).not.toContain("NotoNaskh");
});

it("embeds Naskh in an Arabic document", async () => {
  const buffer = await renderInvoicePdf(pdfFixture(1), owner, arLabels, "ar");
  expect(buffer.toString("latin1")).toContain("NotoNaskh");
});

it("rejects when a Naskh TTF is missing", async () => {
  const original = naskhFontPaths.regular;
  naskhFontPaths.regular = path.resolve("fonts/missing-naskh.ttf");
  try {
    await expect(renderInvoicePdf(pdfFixture(1), owner, arLabels, "ar")).rejects.toThrow();
  } finally {
    naskhFontPaths.regular = original;
  }
});

it("renders an English Helvetica document when Naskh TTF is missing", async () => {
  const original = naskhFontPaths.regular;
  naskhFontPaths.regular = path.resolve("fonts/missing-naskh.ttf");
  try {
    const buffer = await renderInvoicePdf(pdfFixture(1), owner, enLabels, "en");
    expect(buffer.toString("latin1")).not.toContain("NotoNaskh");
  } finally {
    naskhFontPaths.regular = original;
  }
});

it("rejects an English document that needs Naskh when the TTF is missing", async () => {
  const original = naskhFontPaths.regular;
  naskhFontPaths.regular = path.resolve("fonts/missing-naskh.ttf");
  try {
    await expect(renderInvoicePdf(pdfFixture(1, "مكتب"), owner, enLabels, "en")).rejects.toThrow();
  } finally {
    naskhFontPaths.regular = original;
  }
});

it("strips bidi isolates from a client name before drawing", async () => {
  const buffer = await renderInvoicePdf(
    pdfFixture(1, "\u2066مكتب\u2069"),
    owner,
    enLabels,
    "en",
  );
  expect(buffer.includes(Buffer.from([0xe2, 0x81, 0xa6]))).toBe(false);
  expect(buffer.toString("latin1")).not.toContain("<2066>");
});
