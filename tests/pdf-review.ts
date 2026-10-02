import { mkdirSync, writeFileSync } from "node:fs";
import { renderInvoicePdf, type PdfInvoice } from "../src/lib/invoice-pdf";
const owner = { businessName: "Example Studio", email: "owner@example.com", currency: "usd" };
const base: PdfInvoice = {
  invoice: { number: "INV-2026-0001", issueDate: "2026-10-01", dueDate: "2026-10-31", taxBps: 850, notes: "Thank you for your business." },
  client: { name: "Example Client", email: "client@example.com", address: "10 Main Street" },
  items: [{ description: "Consulting service", quantity: 2, unitPriceCents: 10000 }],
};
async function main() {
  mkdirSync("tmp/pdf-review", { recursive: true });
  const samples = {
    short: base,
    thirty: { ...base, items: Array.from({ length: 30 }, (_, i) => ({ ...base.items[0], description: `Service ${i + 1}` })) },
    long: { ...base, client: { ...base.client, address: "Long billing address with street, suite, and locality. ".repeat(80) + "ADDRESS_END" }, invoice: { ...base.invoice, notes: "Detailed payment instructions and reference information. ".repeat(150) + "NOTES_END" }, items: [{ ...base.items[0], description: "A very long description of the completed work. ".repeat(120) + "DESCRIPTION_END" }, { description: "FINAL_ITEM", quantity: 1, unitPriceCents: 15000 }] },
    large: { ...base, invoice: { ...base.invoice, taxBps: 0 }, items: [{ description: "Large amount", quantity: 1, unitPriceCents: Number.MAX_SAFE_INTEGER }] },
  };
  for (const [name, sample] of Object.entries(samples)) writeFileSync(`tmp/pdf-review/${name}.pdf`, await renderInvoicePdf(sample, owner));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
