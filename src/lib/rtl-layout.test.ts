import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app", "src/components"];

const FORBIDDEN_CLASS_PREFIXES = ["ml-", "mr-", "pl-", "pr-", "left-", "right-"];
const FORBIDDEN_CLASS_EXACT = ["text-left", "text-right"];

// Allowlist entries exempt a specific file + value from the checks below.
// Reserve this for copy that must stay as-is (a URL, a sample email address,
// a product token) — never for whole pages or user-visible strings.
const CLASS_ALLOWLIST: Record<string, string[]> = {};
const TEXT_ALLOWLIST: Record<string, string[]> = {};

// "InvoiceFlow" is the product name and is exempt everywhere without an
// allowlist entry.
const EXEMPT_TEXT = "InvoiceFlow";

function listTsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTsxFiles(full));
    else if (entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

function toRelative(filePath: string): string {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

/** Strips a Tailwind variant chain (e.g. "sm:hover:ml-4" -> "ml-4"). */
function baseClassToken(token: string): string {
  const idx = token.lastIndexOf(":");
  return idx === -1 ? token : token.slice(idx + 1);
}

function isForbiddenClassToken(token: string): boolean {
  const base = baseClassToken(token);
  if (FORBIDDEN_CLASS_EXACT.includes(base)) return true;
  return FORBIDDEN_CLASS_PREFIXES.some((prefix) => base.startsWith(prefix));
}

/** Recursively collects every string/template literal fragment under `node`. */
function collectStringLiterals(node: ts.Node, out: string[]): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.push(node.text);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    out.push(node.head.text);
    for (const span of node.templateSpans) {
      collectStringLiterals(span.expression, out);
      out.push(span.literal.text);
    }
    return;
  }
  node.forEachChild((child) => collectStringLiterals(child, out));
}

type Violation = { file: string; value: string };

function scanFile(file: string): { classViolations: Violation[]; textViolations: Violation[] } {
  const relative = toRelative(file);
  const content = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const classViolations: Violation[] = [];
  const textViolations: Violation[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText() === "className" && node.initializer) {
      const literals: string[] = [];
      if (ts.isStringLiteral(node.initializer)) {
        literals.push(node.initializer.text);
      } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        collectStringLiterals(node.initializer.expression, literals);
      }
      for (const literal of literals) {
        for (const token of literal.split(/\s+/).filter(Boolean)) {
          if (!isForbiddenClassToken(token)) continue;
          const allowed = CLASS_ALLOWLIST[relative]?.includes(token) ?? false;
          if (!allowed) classViolations.push({ file: relative, value: token });
        }
      }
    }

    if (ts.isJsxText(node)) {
      const matches = node.text.match(/[A-Za-z]{4,}/g) ?? [];
      for (const match of matches) {
        if (match === EXEMPT_TEXT) continue;
        const allowed = TEXT_ALLOWLIST[relative]?.includes(match) ?? false;
        if (!allowed) textViolations.push({ file: relative, value: match });
      }
    }

    node.forEachChild(visit);
  }

  visit(sourceFile);
  return { classViolations, textViolations };
}

const files = ROOTS.flatMap((root) => listTsxFiles(path.join(process.cwd(), root)));

const allClassViolations: Violation[] = [];
const allTextViolations: Violation[] = [];
for (const file of files) {
  const { classViolations, textViolations } = scanFile(file);
  allClassViolations.push(...classViolations);
  allTextViolations.push(...textViolations);
}

describe("RTL layout", () => {
  it("uses logical direction classes instead of physical ones", () => {
    const formatted = allClassViolations.map((v) => `${v.file}: "${v.value}"`);
    expect(formatted).toEqual([]);
  });

  it("has no untranslated Latin text in JSX", () => {
    const formatted = allTextViolations.map((v) => `${v.file}: "${v.value}"`);
    expect(formatted).toEqual([]);
  });
});
