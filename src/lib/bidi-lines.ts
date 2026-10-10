import bidiFactory, { type EmbeddingLevels } from "bidi-js";

export type { EmbeddingLevels };

const bidi = bidiFactory();

const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const LAM = "\u0644";
const ALEF = new Set(["\u0627", "\u0622", "\u0623", "\u0625"]);
const graphemeSegmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });

export function stripBidiControls(value: string): string {
  return value.replace(BIDI_CONTROLS, "");
}

export function paragraphLevels(
  text: string,
  base: "ltr" | "rtl",
): EmbeddingLevels {
  return bidi.getEmbeddingLevels(text, base);
}

export function reorderLine(
  text: string,
  levels: EmbeddingLevels,
  start: number,
  end: number,
): { text: string; level: number }[] {
  const visual = bidi
    .getReorderedString(text, levels, start, end)
    .slice(start, end + 1);
  const indices = bidi
    .getReorderedIndices(text, levels, start, end)
    .slice(start, end + 1);
  const runs: { text: string; level: number }[] = [];

  for (let i = 0; i < visual.length; i++) {
    const ch = visual[i];
    const level = levels.levels[indices[i]];
    const last = runs[runs.length - 1];
    if (last && last.level === level) {
      last.text += ch;
    } else {
      runs.push({ text: ch, level });
    }
  }

  return runs;
}

function graphemeClusters(value: string): string[] {
  return Array.from(graphemeSegmenter.segment(value), (part) => part.segment);
}

function clusterBase(cluster: string): string {
  return String.fromCodePoint(cluster.codePointAt(0) ?? 0);
}

function splitUnits(value: string): string[] {
  const clusters = graphemeClusters(value);
  const units: string[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const next = clusters[i + 1];
    if (
      next &&
      clusterBase(clusters[i]) === LAM &&
      ALEF.has(clusterBase(next))
    ) {
      units.push(clusters[i] + next);
      i += 1;
    } else {
      units.push(clusters[i]);
    }
  }

  return units;
}

export function splitOversizedToken(
  value: string,
  widthOf: (piece: string) => number,
  columnWidth: number,
): string[] {
  const pieces: string[] = [];
  let current = "";

  for (const unit of splitUnits(value)) {
    if (current === "") {
      current = unit;
      continue;
    }

    const candidate = current + unit;
    if (widthOf(candidate) <= columnWidth) {
      current = candidate;
    } else {
      pieces.push(current);
      current = unit;
    }
  }

  if (current !== "") {
    pieces.push(current);
  }

  return pieces;
}
