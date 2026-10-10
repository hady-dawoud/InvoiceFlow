import { createRequire } from "node:module";
import path from "node:path";
import { expect, it } from "vitest";
import { isWinAnsi, spikeDrawnCharacters } from "./pdf-spike-samples";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as {
  openSync: (file: string) => { hasGlyphForCodePoint: (codePoint: number) => boolean };
};

it("covers every spike sample character in Naskh or WinAnsi", () => {
  const fontPath = path.resolve(
    process.cwd(),
    "fonts/NotoNaskhArabic-Regular.ttf",
  );
  const font = fontkit.openSync(fontPath);
  const missing: string[] = [];

  for (const character of spikeDrawnCharacters()) {
    const codePoint = character.codePointAt(0);
    if (codePoint == null) continue;
    if (font.hasGlyphForCodePoint(codePoint) || isWinAnsi(codePoint)) continue;
    missing.push(`U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`);
  }

  expect(missing, missing.join(", ")).toEqual([]);
});
