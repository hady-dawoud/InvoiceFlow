import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import {
  paragraphLevels,
  reorderLine,
  splitOversizedToken,
  stripBidiControls,
  type EmbeddingLevels,
} from "../src/lib/bidi-lines";
import { formatCents } from "../src/lib/money";
import { isWinAnsi, SPIKE_SAMPLE_STRINGS } from "../src/lib/pdf-spike-samples";
import { textDirection } from "../src/lib/text-direction";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGULAR = path.join(ROOT, "fonts/NotoNaskhArabic-Regular.ttf");
const BOLD = path.join(ROOT, "fonts/NotoNaskhArabic-Bold.ttf");
const OUT_PDF = path.join(ROOT, "tmp/pdf-bidi-spike.pdf");

const NASKH = "NotoNaskhArabic";
const NASKH_BOLD = "NotoNaskhArabic-Bold";
const CAPTION_SIZE = 8;
const BODY_SIZE = 11;
const TITLE_SIZE = 14;
const LINE_GAP = 15;
const LEFT = 48;
const RIGHT = 564;
const WRAP_WIDTH = 220;

/** Fontkit joining features. The Arabic shaper also enables init/medi/fina/isol. */
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

const graphemeSegmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });

type Locale = "en" | "ar";
type Face = "naskh" | "naskh-bold" | "helvetica" | "helvetica-bold";
type Align = "start" | "end" | "numeric";
type Position = {
  xAdvance: number;
  advanceWidth: number;
  xOffset: number;
  yOffset: number;
};

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

let naskhCmap: { hasGlyphForCodePoint: (codePoint: number) => boolean };

function naskhCovers(cluster: string): boolean {
  return [...cluster].every((ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return cp === 0x200c || cp === 0x200d || naskhCmap.hasGlyphForCodePoint(cp);
  });
}

function chooseFace(cluster: string, locale: Locale, bold: boolean): Face {
  const naskhOk = naskhCovers(cluster);
  const winAnsiOk = [...cluster].every((ch) => isWinAnsi(ch.codePointAt(0) ?? 0));
  if (locale === "ar") {
    if (naskhOk) return bold ? "naskh-bold" : "naskh";
    if (winAnsiOk) return bold ? "helvetica-bold" : "helvetica";
    return "helvetica";
  }
  if (winAnsiOk) return bold ? "helvetica-bold" : "helvetica";
  if (naskhOk) return bold ? "naskh-bold" : "naskh";
  return "helvetica";
}

function setFace(doc: PDFKit.PDFDocument, face: Face, size: number) {
  const name =
    face === "naskh"
      ? NASKH
      : face === "naskh-bold"
        ? NASKH_BOLD
        : face === "helvetica-bold"
          ? "Helvetica-Bold"
          : "Helvetica";
  doc.font(name).fontSize(size);
}

function isNaskh(face: Face) {
  return face === "naskh" || face === "naskh-bold";
}

function toLogical(visual: string, level: number): string {
  if (level % 2 === 0) return visual;
  return [...visual]
    .reverse()
    .map((ch) => MIRROR[ch] ?? ch)
    .join("");
}

function encodeNaskh(
  doc: PdfKitDoc,
  text: string,
  rtl: boolean,
): [string[], Position[]] {
  const embedded = doc._font;
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

function pdfNumber(value: number): string {
  if (value > -1e-21 && value < 1e-21) return "0";
  return value.toFixed(10).replace(/\.?0+$/, "");
}

function drawEncoded(
  doc: PdfKitDoc,
  encoded: string[],
  positions: Position[],
  x: number,
  y: number,
) {
  const scale = doc._fontSize / 1000;
  const dy = (doc._font.ascender / 1000) * doc._fontSize;
  let cursorX = x;
  if (doc.page.fonts[doc._font.id] == null) {
    doc.page.fonts[doc._font.id] = doc._font.ref();
  }
  doc.save();
  doc.transform(1, 0, 0, -1, 0, doc.page.height);
  const pdfY = doc.page.height - y - dy;
  doc.addContent("BT");
  doc.addContent(`1 0 0 1 ${pdfNumber(cursorX)} ${pdfNumber(pdfY)} Tm`);
  doc.addContent(`/${doc._font.id} ${pdfNumber(doc._fontSize)} Tf`);
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
      doc.addContent(`[${commands.join(" ")}] TJ`);
      commands.length = 0;
    }
  };
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (pos.xOffset || pos.yOffset) {
      flush(i);
      doc.addContent(
        `1 0 0 1 ${pdfNumber(cursorX + pos.xOffset * scale)} ${pdfNumber(pdfY + pos.yOffset * scale)} Tm`,
      );
      flush(i + 1);
      hadOffset = true;
    } else {
      if (hadOffset) {
        doc.addContent(`1 0 0 1 ${pdfNumber(cursorX)} ${pdfNumber(pdfY)} Tm`);
        hadOffset = false;
      }
      if (pos.xAdvance - pos.advanceWidth !== 0) addSegment(i + 1);
    }
    cursorX += pos.xAdvance * scale;
  }
  flush(positions.length);
  doc.addContent("ET");
  doc.restore();
}

function preparedCluster(cluster: string, face: Face): string {
  if (isNaskh(face)) return naskhCovers(cluster) ? cluster : "?";
  const ok = [...cluster].every((ch) => isWinAnsi(ch.codePointAt(0) ?? 0));
  return ok ? cluster : "?";
}

function measureLogical(
  doc: PdfKitDoc,
  text: string,
  locale: Locale,
  size: number,
  bold: boolean,
): number {
  if (!text) return 0;
  let width = 0;
  let piece = "";
  let face: Face | null = null;
  const flush = () => {
    if (!piece || !face) return;
    setFace(doc, face, size);
    width += doc.widthOfString(piece, {
      features: isNaskh(face) ? FONT_FEATURES : undefined,
    });
    piece = "";
  };
  for (const { segment } of graphemeSegmenter.segment(text)) {
    const next = chooseFace(segment, locale, bold);
    const cluster = preparedCluster(segment, next);
    if (face && next !== face) flush();
    face = next;
    piece += cluster;
  }
  flush();
  return width;
}

function wrapParagraph(
  text: string,
  columnWidth: number,
  widthOf: (piece: string) => number,
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
    const pieces = splitOversizedToken(token, widthOf, columnWidth);
    let offset = at;
    for (const piece of pieces) {
      lines.push({ start: offset, end: offset + piece.length - 1 });
      offset += piece.length;
    }
  };

  for (const word of words) {
    const token = text.slice(word.start, word.end);
    if (lineWords.length === 0 && widthOf(token) > columnWidth) {
      emitPieces(token, word.start);
      continue;
    }
    const trial = lineWords.length
      ? text.slice(lineWords[0].start, word.end)
      : token;
    if (lineWords.length && widthOf(trial) > columnWidth) {
      flushLine();
      if (widthOf(token) > columnWidth) {
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

function drawVisualLine(
  doc: PdfKitDoc,
  logical: string,
  levels: EmbeddingLevels,
  start: number,
  end: number,
  locale: Locale,
  size: number,
  bold: boolean,
  x: number,
  y: number,
) {
  const runs = reorderLine(logical, levels, start, end);
  let cursor = x;
  for (const run of runs) {
    const logicalRun = toLogical(run.text, run.level);
    const pieces: { face: Face; text: string }[] = [];
    for (const { segment } of graphemeSegmenter.segment(logicalRun)) {
      const face = chooseFace(segment, locale, bold);
      const text = preparedCluster(segment, face);
      const last = pieces[pieces.length - 1];
      if (last && last.face === face) last.text += text;
      else pieces.push({ face, text });
    }
    for (const piece of pieces) {
      setFace(doc, piece.face, size);
      const [encoded, positions] = isNaskh(piece.face)
        ? encodeNaskh(doc, piece.text, run.level % 2 === 1)
        : doc._font.encode(piece.text);
      const width = positions.reduce((sum, pos) => sum + pos.xAdvance, 0) * (size / 1000);
      drawEncoded(doc, encoded, positions, cursor, y);
      cursor += width;
    }
  }
}

function drawParagraph(
  doc: PdfKitDoc,
  raw: string,
  locale: Locale,
  size: number,
  bold: boolean,
  boxX: number,
  boxWidth: number,
  y: number,
  align: Align,
): number {
  let nextY = y;
  for (const paragraph of stripBidiControls(raw).split("\n")) {
    if (paragraph === "") {
      nextY += LINE_GAP;
      continue;
    }
    const base = align === "numeric" ? "ltr" : textDirection(paragraph);
    const levels = paragraphLevels(paragraph, base);
    const widthOf = (piece: string) => measureLogical(doc, piece, locale, size, bold);
    const ranges = wrapParagraph(paragraph, boxWidth, widthOf);
    const flushRight = align === "numeric" || align === "end" || (align === "start" && base === "rtl");
    for (const range of ranges) {
      const line = paragraph.slice(range.start, range.end + 1);
      const lineWidth = widthOf(line);
      const x = flushRight ? boxX + boxWidth - lineWidth : boxX;
      drawVisualLine(doc, paragraph, levels, range.start, range.end, locale, size, bold, x, nextY);
      nextY += LINE_GAP;
    }
  }
  return nextY;
}

function caption(doc: PDFKit.PDFDocument, text: string, y: number) {
  doc.font("Helvetica").fontSize(CAPTION_SIZE).fillColor("#64748b");
  doc.text(text, LEFT, y, { lineBreak: false });
  return y + 11;
}

async function renderSpike() {
  await fs.mkdir(path.join(ROOT, "tmp"), { recursive: true });
  const doc = new PDFDocument({ size: "LETTER", margin: 40 }) as PdfKitDoc;
  doc.registerFont(NASKH, REGULAR);
  doc.registerFont(NASKH_BOLD, BOLD);
  doc.font(NASKH);
  naskhCmap = doc._font.font!;

  const done = new Promise<void>((resolve, reject) => {
    const out = createWriteStream(OUT_PDF);
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
    doc.pipe(out);
  });

  doc.font(NASKH_BOLD).fontSize(TITLE_SIZE).fillColor("#0f172a");
  const title = "Arabic PDF spike";
  const titleLevels = paragraphLevels(title, "ltr");
  drawVisualLine(doc, title, titleLevels, 0, title.length - 1, "en", TITLE_SIZE, true, LEFT, 36);

  let y = 58;
  const samples: { caption: string; text: string; locale: Locale; wrap?: number; align: Align }[] = [
    { caption: "Short Arabic word", text: SPIKE_SAMPLE_STRINGS[0], locale: "ar", align: "end" },
    { caption: "Lam-alef (U+0627, U+0622, U+0623, U+0625)", text: SPIKE_SAMPLE_STRINGS[1], locale: "ar", align: "end" },
    { caption: "Lam + fatha + alef", text: SPIKE_SAMPLE_STRINGS[2], locale: "ar", align: "end" },
    { caption: "Word with diacritics", text: SPIKE_SAMPLE_STRINGS[3], locale: "ar", align: "end" },
    { caption: "Mixed email and Western-digit amount", text: SPIKE_SAMPLE_STRINGS[4], locale: "ar", align: "end" },
    {
      caption: "Wrapping paragraph (narrow column)",
      text: SPIKE_SAMPLE_STRINGS[5],
      locale: "ar",
      wrap: WRAP_WIDTH,
      align: "end",
    },
    { caption: "Arabic with an English word inside", text: SPIKE_SAMPLE_STRINGS[6], locale: "ar", align: "end" },
    {
      caption: "English document, Arabic client name",
      text: `Client: ${SPIKE_SAMPLE_STRINGS[7]}`,
      locale: "en",
      align: "start",
    },
    { caption: "Parentheses around Arabic, RTL paragraph", text: SPIKE_SAMPLE_STRINGS[10], locale: "ar", align: "end" },
    {
      caption: "Arabic company name with Acme (Egypt), RTL paragraph",
      text: SPIKE_SAMPLE_STRINGS[11],
      locale: "ar",
      align: "end",
    },
    { caption: "Smart quotes and em dash in Arabic", text: SPIKE_SAMPLE_STRINGS[12], locale: "ar", align: "end" },
    {
      caption: "Smart quotes and em dash in an English note",
      text: SPIKE_SAMPLE_STRINGS[13],
      locale: "en",
      align: "start",
    },
    { caption: "Isolates stripped (U+2066 through U+2069)", text: SPIKE_SAMPLE_STRINGS[14], locale: "ar", align: "end" },
    { caption: "ZWNJ versus joined Arabic letters", text: SPIKE_SAMPLE_STRINGS[15], locale: "ar", align: "end" },
  ];

  for (const sample of samples) {
    y = caption(doc, sample.caption, y);
    doc.fillColor("#0f172a");
    const width = sample.wrap ?? RIGHT - LEFT;
    const boxX = sample.align === "end" ? RIGHT - width : LEFT;
    if (sample.wrap) {
      doc.save();
      doc.rect(boxX, y - 2, width, 56).strokeColor("#cbd5e1").lineWidth(0.4).stroke();
      doc.restore();
    }
    y = drawParagraph(doc, sample.text, sample.locale, BODY_SIZE, false, boxX, width, y, sample.align);
    y += 4;
  }

  y = caption(
    doc,
    "Arabic document: phone in a text column, amount in an LTR numeric column",
    y,
  );
  const textColW = 240;
  const numColW = 120;
  const textColX = RIGHT - textColW;
  const numColX = LEFT;
  doc.save();
  doc.rect(textColX, y - 2, textColW, 22).strokeColor("#cbd5e1").lineWidth(0.4).stroke();
  doc.rect(numColX, y - 2, numColW, 22).strokeColor("#cbd5e1").lineWidth(0.4).stroke();
  doc.restore();
  doc.fillColor("#0f172a");
  drawParagraph(doc, SPIKE_SAMPLE_STRINGS[8], "ar", BODY_SIZE, false, textColX, textColW, y, "end");
  drawParagraph(doc, formatCents(-5000, "usd"), "ar", BODY_SIZE, false, numColX, numColW, y, "numeric");

  doc.font("Helvetica").fontSize(7).fillColor("#94a3b8");
  doc.text(
    "Shaping: Fontkit joining. Features: rlig liga calt ccmp locl mark mkmk kern curs. Body 11pt Regular, title 14pt Bold. paragraphLevels once per paragraph, reorderLine per wrapped line.",
    LEFT,
    750,
    { lineBreak: false },
  );

  doc.end();
  await done;
  process.stdout.write(`${OUT_PDF}\n`);
}

renderSpike().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
