import { formatCents } from "./money";
import { stripBidiControls } from "./bidi-lines";

export const WRAP_PARAGRAPH =
  "هذه فقرة عربية طويلة بما يكفي لتلتف داخل عمود ضيق، فيكمل السطر التالي الجملة نفسها دون أن تنقطع الكلمة في غير موضعها.";

/** Strings the spike draws. Bidi controls are stripped before drawing. */
export const SPIKE_SAMPLE_STRINGS = [
  "مكتب",
  "لا لآ لأ لإ",
  "لَا",
  "كَتَبَ",
  "مكتب hello@example.com $50.00",
  WRAP_PARAGRAPH,
  "نص عربي مع English داخل السطر",
  "مكتب النور",
  "+20 100 123 4567",
  formatCents(-5000, "usd"),
  "(مكتب)",
  "شركة Acme (Egypt)",
  "قال “مرحبا” — ثم ذهب…",
  "He said “hello” — then left…",
  "\u2066مكتب\u2069",
  "ب\u200Cيت بيت",
];

const REQUIRED_CODE_POINTS = [
  "A",
  "@",
  ".",
  "_",
  "+",
  "-",
  "$",
  ",",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "\u0627",
  "\u0622",
  "\u0623",
  "\u0625",
  "\u0644",
  "\u064E",
];

/** Windows-1252 / PDF WinAnsiEncoding Unicode coverage. */
const WINANSI_EXTRA = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

export function isWinAnsi(codePoint: number): boolean {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true;
  return WINANSI_EXTRA.has(codePoint);
}

export function spikeDrawnCharacters(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sample of [...SPIKE_SAMPLE_STRINGS, ...REQUIRED_CODE_POINTS]) {
    for (const character of stripBidiControls(sample)) {
      if (!seen.has(character)) {
        seen.add(character);
        out.push(character);
      }
    }
  }
  return out;
}
