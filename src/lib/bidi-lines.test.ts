import { expect, it } from "vitest";
import {
  paragraphLevels,
  reorderLine,
  splitOversizedToken,
  stripBidiControls,
} from "./bidi-lines";

function lineRuns(text: string, base: "ltr" | "rtl") {
  const levels = paragraphLevels(text, base);
  return reorderLine(text, levels, 0, text.length - 1);
}

it("strips bidi controls and keeps ZWNJ and ZWJ", () => {
  const kept = "\u200C\u200D";
  const stripped =
    "\u061C\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069";
  expect(stripBidiControls(`كتب${stripped}${kept}مكتب`)).toBe(`كتب${kept}مكتب`);
});

it("reorders a phone number and an amount for each base", () => {
  const phone = "+20 100 123 4567";
  expect(lineRuns(phone, "ltr")).toEqual([
    { text: "+20 100 123 4567", level: 0 },
  ]);
  expect(lineRuns(phone, "rtl")).toEqual([
    { text: "4567", level: 2 },
    { text: " ", level: 1 },
    { text: "123", level: 2 },
    { text: " ", level: 1 },
    { text: "100", level: 2 },
    { text: " ", level: 1 },
    { text: "20", level: 2 },
    { text: "+", level: 1 },
  ]);

  const amount = "-$50.00";
  expect(lineRuns(amount, "ltr")).toEqual([{ text: "-$50.00", level: 0 }]);
  expect(lineRuns(amount, "rtl")).toEqual([
    { text: "$50.00", level: 2 },
    { text: "-", level: 1 },
  ]);
});

it("mirrors parentheses and keeps Acme (Egypt) as one even-level run", () => {
  const office = "(مكتب)";
  const officeRuns = lineRuns(office, "rtl");
  expect(officeRuns).toEqual([{ text: "(بتكم)", level: 1 }]);
  expect([...officeRuns[0].text].map((ch) => ch.codePointAt(0))).toEqual([
    0x0028, 0x0628, 0x062a, 0x0643, 0x0645, 0x0029,
  ]);

  expect(lineRuns("Acme (Egypt)", "rtl")).toEqual([
    { text: "Acme (Egypt)", level: 2 },
  ]);
  expect(lineRuns("شركة Acme (Egypt)", "rtl")).toEqual([
    { text: "Acme (Egypt)", level: 2 },
    { text: " ةكرش", level: 1 },
  ]);
});

it("reorders a wrapped line from paragraph levels, not a sliced recompute", () => {
  const text = "كتب $50 التالي";
  const start = text.indexOf("$");
  const levels = paragraphLevels(text, "rtl");
  expect(reorderLine(text, levels, start, text.length - 1)).toEqual([
    { text: "يلاتلا ", level: 1 },
    { text: "50", level: 2 },
    { text: "$", level: 1 },
  ]);

  const sliced = paragraphLevels("$50 التالي", "rtl").levels;
  const fromParagraph = levels.levels.slice(start);
  expect(sliced[0]).toBe(2);
  expect(fromParagraph[0]).toBe(1);
  expect([...sliced]).not.toEqual([...fromParagraph]);
});

it("keeps lam-alef pairs together when splitting an oversized token", () => {
  const widthOf = (piece: string) => piece.length;
  const alefForms = ["\u0627", "\u0622", "\u0623", "\u0625"];
  for (const alef of alefForms) {
    expect(splitOversizedToken(`ب\u0644${alef}`, widthOf, 2)).toEqual([
      "ب",
      `\u0644${alef}`,
    ]);
  }

  expect(splitOversizedToken("بلَا", widthOf, 2)).toEqual(["ب", "لَا"]);
  expect(splitOversizedToken("ك", widthOf, 0)).toEqual(["ك"]);
  expect(splitOversizedToken("لا", widthOf, 1)).toEqual(["لا"]);
});
