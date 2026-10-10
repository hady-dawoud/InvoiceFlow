import path from "node:path";
import { inflateSync } from "node:zlib";
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

function pdfObjects(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const objects = new Map<number, { dict: string; at: number }>();
  for (const match of source.matchAll(/(\d+) 0 obj\n<<([\s\S]*?)>>/g)) {
    objects.set(Number(match[1]), { dict: match[2], at: match.index ?? 0 });
  }
  return { source, objects };
}

function pdfStream(buffer: Buffer, source: string, at: number): string {
  const start = source.indexOf("stream\n", at) + "stream\n".length;
  const end = source.indexOf("\nendstream", start);
  const raw = buffer.subarray(start, end);
  try {
    return inflateSync(raw).toString("latin1");
  } catch {
    return raw.toString("latin1");
  }
}

function unicodeByGlyph(cmap: string): Map<number, string> {
  const glyphs = new Map<number, string>();
  for (const match of cmap.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
    const start = Number.parseInt(match[1], 16);
    const entries = [...match[3].matchAll(/<([0-9A-Fa-f]*)>/g)];
    entries.forEach((entry, index) => {
      if (!entry[1]) return;
      glyphs.set(start + index, String.fromCodePoint(Number.parseInt(entry[1], 16)));
    });
  }
  return glyphs;
}

/** Page content stores glyph ids, so tests rebuild the left-to-right text. */
function visualPdfText(buffer: Buffer): string {
  const { source, objects } = pdfObjects(buffer);
  const glyphsByFont = new Map<string, Map<number, string>>();
  for (const object of objects.values()) {
    const unicode = object.dict.match(/\/ToUnicode (\d+) 0 R/);
    const base = object.dict.match(/\/BaseFont \/(\S+)/);
    if (!unicode || !base) continue;
    const target = objects.get(Number(unicode[1]));
    if (!target) continue;
    glyphsByFont.set(base[1], unicodeByGlyph(pdfStream(buffer, source, target.at)));
  }

  const page = [...source.matchAll(/stream\n/g)]
    .map((match) => pdfStream(buffer, source, (match.index ?? 0) - 20))
    .find((stream) => stream.includes(" TJ"));
  if (!page) return "";

  const resource = [...objects.values()].find((object) => object.dict.includes("/Font <<"));
  const fontForResource = new Map<string, Map<number, string>>();
  for (const match of resource?.dict.matchAll(/\/(F\d+) (\d+) 0 R/g) ?? []) {
    const font = objects.get(Number(match[2]));
    const base = font?.dict.match(/\/BaseFont \/(\S+)/)?.[1];
    const glyphs = base ? glyphsByFont.get(base) : undefined;
    if (glyphs) fontForResource.set(match[1], glyphs);
  }

  let glyphs = fontForResource.values().next().value;
  let x = 0;
  let y = 0;
  const chunks: { x: number; y: number; text: string }[] = [];
  for (const match of page.matchAll(/\/(F\d+)\s+[\d.]+ Tf|1 0 0 1 ([\d.]+) ([\d.]+) Tm|\[([^\]]*)\] TJ/g)) {
    if (match[1]) glyphs = fontForResource.get(match[1]) ?? glyphs;
    else if (match[2]) {
      x = Number(match[2]);
      y = Number(match[3]);
    } else if (match[4] && glyphs) {
      let text = "";
      for (const hex of match[4].matchAll(/<([0-9A-Fa-f]+)>/g)) {
        for (let index = 0; index < hex[1].length; index += 4) {
          const id = Number.parseInt(hex[1].slice(index, index + 4), 16);
          text += glyphs.get(id) ?? "";
        }
      }
      chunks.push({ x, y, text });
    }
  }

  const rows = new Map<number, typeof chunks>();
  for (const chunk of chunks) {
    const row = Math.round(chunk.y);
    rows.set(row, [...(rows.get(row) ?? []), chunk]);
  }
  return [...rows.keys()]
    .sort((a, b) => b - a)
    .map((row) => (rows.get(row) ?? []).sort((a, b) => a.x - b.x).map((chunk) => chunk.text).join(""))
    .join("\n");
}

it("keeps an Arabic document's issue and due dates in stored order", async () => {
  const buffer = await renderInvoicePdf(pdfFixture(1), owner, arLabels, "ar");
  const visual = visualPdfText(buffer);

  expect(visual).toContain("2026-10-01");
  expect(visual).toContain("2026-10-31");
  expect(visual).not.toContain("01-10-2026");
  expect(visual).not.toContain("31-10-2026");
});

it("keeps the Arabic tax rate beside the label with the percent after the number", async () => {
  const buffer = await renderInvoicePdf(pdfFixture(1), owner, arLabels, "ar");
  const visual = visualPdfText(buffer);

  expect(visual).toContain("(8.5%)");
  expect(visual).not.toContain("(%8.5)");
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
