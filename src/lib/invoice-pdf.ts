import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  paragraphLevels,
  reorderLine,
  splitOversizedToken,
  stripBidiControls,
  type EmbeddingLevels,
} from "@/lib/bidi-lines";
import { calcTotals, formatCents } from "@/lib/money";
import type { DocumentLocale, InvoiceInput } from "@/lib/data/invoices";
import { textDirection } from "@/lib/text-direction";

export type PdfInvoice = {
  invoice: { number: string; issueDate: string; dueDate: string; taxBps: number; notes: string | null };
  client: { name: string; email: string | null; address: string | null };
  items: InvoiceInput["items"];
};
export type PdfOwner = { businessName: string; email: string; currency: string };
export type PdfLabels = {
  title: string;
  billedTo: string;
  issued: string;
  due: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  tax: string;
  totalDue: string;
  notes: string;
};

export const naskhFontPaths = {
  regular: path.resolve(process.cwd(), "fonts/NotoNaskhArabic-Regular.ttf"),
  bold: path.resolve(process.cwd(), "fonts/NotoNaskhArabic-Bold.ttf"),
};

const LEFT = 50;
const RIGHT = 562;
const CONTENT_BOTTOM = 720;
const LINE_HEIGHT = 14;
const NASKH = "NotoNaskhArabic";
const NASKH_BOLD = "NotoNaskhArabic-Bold";
const TITLE_SIZE_AR = 14;
const TITLE_SIZE_EN = 22;
const BODY_SIZE_AR = 11;
const BODY_SIZE_EN = 10;

const FONT_FEATURES = {
  rlig: true,
  liga: true,
  calt: true,
  ccmp: true,
  locl: true,
  mark: true,
  mkmk: true,
  kern: true,
  curs: true,
};

const MIRROR: Record<string, string> = {
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
  "<": ">",
  ">": "<",
  "«": "»",
  "»": "«",
};

const WINANSI_EXTRA = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const graphemeSegmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });

type Face = "naskh" | "naskh-bold" | "helvetica" | "helvetica-bold";
type Align = "start" | "end" | "numeric" | "notes";
type Column = { text: string; x: number; width: number; align: Align; bold?: boolean; size?: number };
type Position = { xAdvance: number; advanceWidth: number; xOffset: number; yOffset: number };
type FontkitGlyph = { id: number; codePoints: number[]; advanceWidth: number };
type FontkitPos = { xAdvance: number; yAdvance: number; xOffset: number; yOffset: number };
type PdfKitDoc = PDFKit.PDFDocument & {
  _font: {
    encode: (text: string, features?: Record<string, boolean>) => [string[], Position[]];
    id: string;
    ref: () => unknown;
    font?: {
      hasGlyphForCodePoint: (codePoint: number) => boolean;
      layout: (
        text: string,
        features: Record<string, boolean>,
        script?: string,
        language?: string,
        direction?: string,
      ) => { glyphs: FontkitGlyph[]; positions: FontkitPos[] };
      glyphForCodePoint: (codePoint: number) => FontkitGlyph;
    };
    scale: number;
    subset: { includeGlyph: (id: number) => number };
    widths: number[];
    unicode: number[][];
    ascender: number;
  };
  _fontSize: number;
  page: { height: number; fonts: Record<string, unknown> };
  addContent: (content: string) => void;
};
type WrappedLine = {
  paragraph: string;
  levels: EmbeddingLevels;
  start: number;
  end: number;
  align: Align;
};

function isWinAnsi(codePoint: number): boolean {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true;
  return WINANSI_EXTRA.has(codePoint);
}

function isNaskh(face: Face) {
  return face === "naskh" || face === "naskh-bold";
}

function documentRtl(locale: DocumentLocale) {
  return locale === "ar";
}

function placeX(x: number, width: number, rtl: boolean) {
  return rtl ? LEFT + RIGHT - x - width : x;
}

function pdfNumber(value: number): string {
  if (value > -1e-21 && value < 1e-21) return "0";
  return value.toFixed(10).replace(/\.?0+$/, "");
}

function toLogical(visual: string, level: number): string {
  if (level % 2 === 0) return visual;
  return [...visual]
    .reverse()
    .map((ch) => MIRROR[ch] ?? ch)
    .join("");
}

function wrapParagraph(
  text: string,
  columnWidth: number,
  widthOf: (start: number, endExclusive: number) => number,
): { start: number; end: number }[] {
  const lines: { start: number; end: number }[] = [];
  const words: { start: number; end: number }[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === " ") {
      cursor++;
      continue;
    }
    const start = cursor;
    while (cursor < text.length && text[cursor] !== " ") cursor++;
    words.push({ start, end: cursor });
  }

  let lineWords: { start: number; end: number }[] = [];
  const flushLine = () => {
    if (lineWords.length === 0) return;
    const start = lineWords[0].start;
    let end = lineWords[lineWords.length - 1].end;
    while (end > start && text[end - 1] === " ") end--;
    lines.push({ start, end: end - 1 });
    lineWords = [];
  };

  const emitPieces = (token: string, at: number) => {
    const pieces = splitOversizedToken(
      token,
      (piece) => widthOf(at, at + piece.length),
      columnWidth,
    );
    let offset = at;
    for (const piece of pieces) {
      lines.push({ start: offset, end: offset + piece.length - 1 });
      offset += piece.length;
    }
  };

  for (const word of words) {
    const token = text.slice(word.start, word.end);
    if (lineWords.length === 0 && widthOf(word.start, word.end) > columnWidth) {
      emitPieces(token, word.start);
      continue;
    }
    const trialStart = lineWords.length ? lineWords[0].start : word.start;
    if (lineWords.length && widthOf(trialStart, word.end) > columnWidth) {
      flushLine();
      if (widthOf(word.start, word.end) > columnWidth) {
        emitPieces(token, word.start);
      } else {
        lineWords = [word];
      }
      continue;
    }
    lineWords.push(word);
  }
  flushLine();
  return lines;
}

class InvoicePdfRenderer {
  private y = 50;
  private naskhCmap: { hasGlyphForCodePoint: (codePoint: number) => boolean } | null = null;
  private readonly rtl: boolean;
  private readonly bodySize: number;
  private readonly titleSize: number;
  private readonly kit: PdfKitDoc;

  constructor(
    private doc: PDFKit.PDFDocument,
    private detail: PdfInvoice,
    private owner: PdfOwner,
    private labels: PdfLabels,
    private locale: DocumentLocale,
  ) {
    this.kit = doc as PdfKitDoc;
    this.rtl = documentRtl(locale);
    this.bodySize = this.rtl ? BODY_SIZE_AR : BODY_SIZE_EN;
    this.titleSize = this.rtl ? TITLE_SIZE_AR : TITLE_SIZE_EN;
  }

  private ensureNaskh() {
    if (this.naskhCmap) return;
    if (!existsSync(naskhFontPaths.regular) || !existsSync(naskhFontPaths.bold)) {
      throw new Error("Missing Noto Naskh Arabic TTF");
    }
    this.doc.registerFont(NASKH, naskhFontPaths.regular);
    this.doc.registerFont(NASKH_BOLD, naskhFontPaths.bold);
    this.doc.font(NASKH);
    const cmap = this.kit._font.font;
    if (!cmap) throw new Error("Missing Noto Naskh Arabic TTF");
    this.naskhCmap = cmap;
  }

  private naskhCovers(cluster: string): boolean {
    this.ensureNaskh();
    return [...cluster].every((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp === 0x200c || cp === 0x200d || this.naskhCmap!.hasGlyphForCodePoint(cp);
    });
  }

  private chooseFace(cluster: string, bold: boolean): Face {
    const naskhOk = this.naskhCovers(cluster);
    const winAnsiOk = [...cluster].every((ch) => isWinAnsi(ch.codePointAt(0) ?? 0));
    if (this.locale === "ar") {
      if (naskhOk) return bold ? "naskh-bold" : "naskh";
      if (winAnsiOk) return bold ? "helvetica-bold" : "helvetica";
      return "helvetica";
    }
    if (winAnsiOk) return bold ? "helvetica-bold" : "helvetica";
    if (naskhOk) return bold ? "naskh-bold" : "naskh";
    return "helvetica";
  }

  private preparedCluster(cluster: string, face: Face): string {
    if (isNaskh(face)) return this.naskhCovers(cluster) ? cluster : "?";
    const ok = [...cluster].every((ch) => isWinAnsi(ch.codePointAt(0) ?? 0));
    return ok ? cluster : "?";
  }

  private setFace(face: Face, size: number) {
    const name =
      face === "naskh"
        ? NASKH
        : face === "naskh-bold"
          ? NASKH_BOLD
          : face === "helvetica-bold"
            ? "Helvetica-Bold"
            : "Helvetica";
    this.doc.font(name).fontSize(size);
  }

  private encodeNaskh(text: string, rtl: boolean): [string[], Position[]] {
    const embedded = this.kit._font;
    const font = embedded.font;
    if (!font) return embedded.encode(text, FONT_FEATURES);
    const script = /[\u0600-\u06FF]/.test(text) ? "arab" : "latn";
    const run = font.layout(text, FONT_FEATURES, script, undefined, rtl ? "rtl" : "ltr");
    const glyphs = [...run.glyphs];
    const positions: Position[] = run.positions.map((position, i) => ({
      xAdvance: position.xAdvance * embedded.scale,
      advanceWidth: glyphs[i].advanceWidth * embedded.scale,
      xOffset: position.xOffset * embedded.scale,
      yOffset: position.yOffset * embedded.scale,
    }));
    if (rtl) {
      for (let i = 0; i < glyphs.length; i++) {
        const codePoint = glyphs[i].codePoints[0];
        if (glyphs[i].codePoints.length !== 1 || codePoint == null) continue;
        const mirrored = MIRROR[String.fromCodePoint(codePoint)];
        if (!mirrored) continue;
        glyphs[i] = font.glyphForCodePoint(mirrored.codePointAt(0) ?? 0);
      }
    }
    const encoded: string[] = [];
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const gid = embedded.subset.includeGlyph(glyph.id);
      encoded.push(`0000${gid.toString(16)}`.slice(-4));
      if (embedded.widths[gid] == null) {
        embedded.widths[gid] = glyph.advanceWidth * embedded.scale;
      }
      if (embedded.unicode[gid] == null) {
        embedded.unicode[gid] = glyph.codePoints;
      }
    }
    return [encoded, positions];
  }

  private layoutPiece(text: string, face: Face, size: number, rtl: boolean) {
    this.setFace(face, size);
    const [encoded, positions] = isNaskh(face)
      ? this.encodeNaskh(text, rtl)
      : this.kit._font.encode(text);
    const width = positions.reduce((sum, pos) => sum + pos.xAdvance, 0) * (size / 1000);
    return { encoded, positions, width };
  }

  private eachLogicalPiece(
    text: string,
    start: number,
    end: number,
    levels: EmbeddingLevels | null,
    bold: boolean,
    fn: (piece: string, face: Face, rtl: boolean) => void,
  ) {
    let piece = "";
    let face: Face | null = null;
    let rtl = false;
    const flush = () => {
      if (!piece || !face) return;
      fn(piece, face, rtl);
      piece = "";
    };
    for (const { segment, index } of graphemeSegmenter.segment(text)) {
      if (index < start) continue;
      if (index > end) break;
      const nextFace = this.chooseFace(segment, bold);
      const cluster = this.preparedCluster(segment, nextFace);
      const nextRtl = levels ? levels.levels[index] % 2 === 1 : /[\u0600-\u06FF]/.test(segment);
      if (face && (nextFace !== face || nextRtl !== rtl)) flush();
      face = nextFace;
      rtl = nextRtl;
      piece += cluster;
    }
    flush();
  }

  private measureRange(
    text: string,
    start: number,
    end: number,
    levels: EmbeddingLevels | null,
    size: number,
    bold: boolean,
  ) {
    if (end < start || !text) return 0;
    let width = 0;
    this.eachLogicalPiece(text, start, end, levels, bold, (piece, face, rtl) => {
      width += this.layoutPiece(piece, face, size, rtl).width;
    });
    return width;
  }

  private measureString(text: string, size: number, bold: boolean) {
    return this.measureRange(text, 0, Math.max(0, text.length - 1), null, size, bold);
  }

  private drawEncoded(encoded: string[], positions: Position[], x: number, y: number) {
    const scale = this.kit._fontSize / 1000;
    const dy = (this.kit._font.ascender / 1000) * this.kit._fontSize;
    let cursorX = x;
    if (this.kit.page.fonts[this.kit._font.id] == null) {
      this.kit.page.fonts[this.kit._font.id] = this.kit._font.ref();
    }
    this.doc.save();
    this.doc.transform(1, 0, 0, -1, 0, this.kit.page.height);
    const pdfY = this.kit.page.height - y - dy;
    this.kit.addContent("BT");
    this.kit.addContent(`1 0 0 1 ${pdfNumber(cursorX)} ${pdfNumber(pdfY)} Tm`);
    this.kit.addContent(`/${this.kit._font.id} ${pdfNumber(this.kit._fontSize)} Tf`);
    const commands: string[] = [];
    let last = 0;
    let hadOffset = false;
    const addSegment = (cur: number) => {
      if (last < cur) {
        const hex = encoded.slice(last, cur).join("");
        const advance = positions[cur - 1].xAdvance - positions[cur - 1].advanceWidth;
        commands.push(`<${hex}> ${pdfNumber(-advance)}`);
      }
      last = cur;
    };
    const flush = (i: number) => {
      addSegment(i);
      if (commands.length > 0) {
        this.kit.addContent(`[${commands.join(" ")}] TJ`);
        commands.length = 0;
      }
    };
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      if (pos.xOffset || pos.yOffset) {
        flush(i);
        this.kit.addContent(
          `1 0 0 1 ${pdfNumber(cursorX + pos.xOffset * scale)} ${pdfNumber(pdfY + pos.yOffset * scale)} Tm`,
        );
        flush(i + 1);
        hadOffset = true;
      } else {
        if (hadOffset) {
          this.kit.addContent(`1 0 0 1 ${pdfNumber(cursorX)} ${pdfNumber(pdfY)} Tm`);
          hadOffset = false;
        }
        if (pos.xAdvance - pos.advanceWidth !== 0) addSegment(i + 1);
      }
      cursorX += pos.xAdvance * scale;
    }
    flush(positions.length);
    this.kit.addContent("ET");
    this.doc.restore();
  }

  private lineX(boxX: number, boxWidth: number, lineWidth: number, align: Align) {
    const flushToRight = align === "start" ? this.rtl : !this.rtl;
    return flushToRight ? boxX + boxWidth - lineWidth : boxX;
  }

  private drawVisualLine(
    logical: string,
    levels: EmbeddingLevels,
    start: number,
    end: number,
    size: number,
    bold: boolean,
    x: number,
  ) {
    const runs = reorderLine(logical, levels, start, end);
    let cursor = x;
    for (const run of runs) {
      const logicalRun = toLogical(run.text, run.level);
      const pieces: { face: Face; text: string }[] = [];
      for (const { segment } of graphemeSegmenter.segment(logicalRun)) {
        const face = this.chooseFace(segment, bold);
        const text = this.preparedCluster(segment, face);
        const last = pieces[pieces.length - 1];
        if (last && last.face === face) last.text += text;
        else pieces.push({ face, text });
      }
      for (const piece of pieces) {
        const laid = this.layoutPiece(piece.text, piece.face, size, run.level % 2 === 1);
        this.drawEncoded(laid.encoded, laid.positions, cursor, this.y);
        cursor += laid.width;
      }
    }
  }

  private paragraphAlign(paragraph: string, requested: Align): Align {
    if (requested !== "notes") return requested;
    const hasLetter = /\p{L}/u.test(paragraph);
    const sheetDir = this.rtl ? "rtl" : "ltr";
    const alignDir = hasLetter ? textDirection(paragraph) : sheetDir;
    return alignDir === sheetDir ? "start" : "end";
  }

  private wrapCell(text: string, width: number, size: number, bold: boolean, align: Align): WrappedLine[] {
    const lines: WrappedLine[] = [];
    for (const paragraph of stripBidiControls(text).split("\n")) {
      const lineAlign = this.paragraphAlign(paragraph, align);
      const base = align === "numeric" ? "ltr" : textDirection(paragraph);
      if (paragraph === "") {
        lines.push({ paragraph: "", levels: paragraphLevels(" ", base), start: 0, end: 0, align: lineAlign });
        continue;
      }
      const levels = paragraphLevels(paragraph, base);
      const widthOf = (start: number, endExclusive: number) =>
        this.measureRange(paragraph, start, endExclusive - 1, levels, size, bold);
      const ranges = wrapParagraph(paragraph, width, widthOf);
      if (ranges.length === 0) {
        lines.push({ paragraph, levels, start: 0, end: -1, align: lineAlign });
        continue;
      }
      for (const range of ranges) {
        lines.push({ paragraph, levels, start: range.start, end: range.end, align: lineAlign });
      }
    }
    return lines;
  }

  private footer() {
    this.doc.font("Helvetica").fontSize(8).fillColor("#94a3b8")
      .text("Created with InvoiceFlow", 252, 750, { lineBreak: false });
  }

  private newPage(table: boolean) {
    this.footer();
    this.doc.addPage();
    this.y = 50;
    this.doc.fillColor("#555");
    this.columns([
      { text: `${this.detail.invoice.number} (continued)`, x: LEFT, width: 240, align: "start", size: this.bodySize },
    ]);
    this.y = 78;
    if (table) this.tableHeading();
  }

  private ensureSpace(height: number, table = false) {
    if (this.y + height > CONTENT_BOTTOM) this.newPage(table);
  }

  private columns(columns: Column[], table = false) {
    const rtl = this.rtl;
    const placed = columns.map((column) => ({
      ...column,
      x: placeX(column.x, column.width, rtl),
      size: column.size ?? this.bodySize,
    }));
    const sizes = placed.map((column) => {
      if (column.align !== "numeric") return column.size;
      const width = this.measureString(column.text.replace(/\n/g, ""), column.size, Boolean(column.bold));
      return Math.min(column.size, (column.width / Math.max(width, 0.01)) * (column.size * 0.98));
    });
    const lines = placed.map((column, i) => this.wrapCell(column.text, column.width, sizes[i], Boolean(column.bold), column.align));
    const count = Math.max(...lines.map((column) => column.length));
    const height = count * LINE_HEIGHT;
    if (height < CONTENT_BOTTOM - 110) this.ensureSpace(height + 12, table);
    for (let i = 0; i < count; i++) {
      this.ensureSpace(LINE_HEIGHT, table);
      placed.forEach((column, index) => {
        const line = lines[index][i];
        if (!line || !line.paragraph || line.end < line.start) return;
        const width = this.measureRange(line.paragraph, line.start, line.end, line.levels, sizes[index], Boolean(column.bold));
        const x = this.lineX(column.x, column.width, width, line.align);
        this.drawVisualLine(line.paragraph, line.levels, line.start, line.end, sizes[index], Boolean(column.bold), x);
      });
      this.y += LINE_HEIGHT;
    }
  }

  private header() {
    this.doc.fillColor("#111");
    this.columns([
      { text: this.labels.title, x: LEFT, width: RIGHT - LEFT, align: "start", bold: true, size: this.titleSize },
    ]);
    this.y += 18;
    this.doc.fillColor("#555");
    this.columns([
      { text: this.detail.invoice.number, x: LEFT, width: 240, align: "start" },
      { text: `${this.owner.businessName}\n${this.owner.email}`, x: 322, width: 240, align: "end" },
    ]);
    this.y += 24;
    const { client, invoice } = this.detail;
    this.columns([
      { text: [this.labels.billedTo, client.name, client.email, client.address].filter(Boolean).join("\n"), x: LEFT, width: 240, align: "start" },
      { text: `${this.labels.issued}: ${invoice.issueDate}\n${this.labels.due}: ${invoice.dueDate}`, x: 322, width: 240, align: "end" },
    ]);
    this.y += 22;
  }

  private tableHeading() {
    this.ensureSpace(28);
    this.doc.rect(LEFT, this.y - 4, RIGHT - LEFT, 24).fill("#f1f5f9");
    this.doc.fillColor("#334155");
    this.columns([
      { text: this.labels.description, x: LEFT + 6, width: 204, align: "start", bold: true, size: this.rtl ? this.bodySize : 9 },
      { text: this.labels.qty, x: 272, width: 64, align: "end", bold: true, size: this.rtl ? this.bodySize : 9 },
      { text: this.labels.unitPrice, x: 344, width: 98, align: "end", bold: true, size: this.rtl ? this.bodySize : 9 },
      { text: this.labels.amount, x: 450, width: 106, align: "end", bold: true, size: this.rtl ? this.bodySize : 9 },
    ]);
    this.y += 12;
    this.doc.fillColor("#111");
  }

  private items() {
    this.tableHeading();
    for (const item of this.detail.items) {
      this.ensureSpace(26, true);
      this.columns([
        { text: item.description, x: LEFT + 6, width: 204, align: "start" },
        { text: String(item.quantity), x: 272, width: 64, align: "numeric" },
        { text: formatCents(item.unitPriceCents, this.owner.currency), x: 344, width: 98, align: "numeric" },
        { text: formatCents(item.quantity * item.unitPriceCents, this.owner.currency), x: 450, width: 106, align: "numeric" },
      ], true);
      this.y += 10;
      this.doc.moveTo(LEFT, this.y - 4).lineTo(RIGHT, this.y - 4).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
    }
  }

  private totals() {
    this.ensureSpace(90);
    this.y += 18;
    const totals = calcTotals(this.detail.items, this.detail.invoice.taxBps);
    this.doc.fillColor("#555");
    this.columns([
      { text: `${this.labels.subtotal}\n${this.labels.tax}\n${this.labels.totalDue}`, x: 322, width: 112, align: "start" },
      { text: [totals.subtotalCents, totals.taxCents, totals.totalCents].map((value) => formatCents(value, this.owner.currency)).join("\n"), x: 442, width: 120, align: "numeric" },
    ]);
    this.y += 22;
  }

  draw() {
    if (this.locale === "ar") this.ensureNaskh();
    this.header();
    this.items();
    this.totals();
    if (this.detail.invoice.notes) {
      this.doc.fillColor("#555");
      this.columns([{ text: this.labels.notes, x: LEFT, width: RIGHT - LEFT, align: "start" }]);
      this.columns([{ text: this.detail.invoice.notes, x: LEFT, width: RIGHT - LEFT, align: "notes" }]);
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

export function renderInvoicePdf(
  detail: PdfInvoice,
  owner: PdfOwner,
  labels: PdfLabels,
  documentLocale: DocumentLocale,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const done = collectPdfStream(doc);
  try {
    new InvoicePdfRenderer(doc, detail, owner, labels, documentLocale).draw();
    doc.end();
  } catch (error) {
    doc.destroy(error instanceof Error ? error : new Error(String(error)));
  }
  return done;
}
