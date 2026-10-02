import { expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { collectPdfStream, renderInvoicePdf, type PdfInvoice } from "./invoice-pdf";
const owner = { businessName: "Example Studio", email: "owner@example.com", currency: "usd" };
function pdfFixture(count: number): PdfInvoice {
  return {
    invoice: { number: "INV-2026-0001", issueDate: "2026-10-01", dueDate: "2026-10-31", taxBps: 850, notes: "Thank you for your business." },
    client: { name: "Example Client", email: "client@example.com", address: "10 Main Street" },
    items: Array.from({ length: count }, (_, index) => ({ description: `Service ${index + 1}`, quantity: 2, unitPriceCents: 10000 })),
  };
}
it.each([[1, 1], [30, 2]])("renders %i line items in %i pages", async (count, pages) => {
  const buffer = await renderInvoicePdf(pdfFixture(count), owner);
  expect(buffer.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(pages);
});
it("rejects drawing errors rather than leaving the PDF response pending", async () => {
  await expect(renderInvoicePdf(pdfFixture(1), { ...owner, currency: "invalid" })).rejects.toThrow();
});

it("rejects PDF stream errors", async () => {
  const doc = new PDFDocument();
  const result = collectPdfStream(doc);
  doc.destroy(new Error("PDF stream failure"));
  await expect(result).rejects.toThrow("PDF stream failure");
});
