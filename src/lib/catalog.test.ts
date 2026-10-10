import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";

// `createElement`'s typings require `children` inside the props object for
// providers whose props type declares it as required. Narrowing to a plain
// function type here lets us pass children positionally instead, matching
// `react/no-children-prop`.
const Provider = NextIntlClientProvider as unknown as (props: {
  locale: string;
  messages: Record<string, string>;
  children?: ReactNode;
}) => ReactElement;

type Catalog = { [key: string]: Catalog | string };

const messagesDir = path.join(process.cwd(), "messages");
const en = JSON.parse(readFileSync(path.join(messagesDir, "en.json"), "utf8")) as Catalog;
const ar = JSON.parse(readFileSync(path.join(messagesDir, "ar.json"), "utf8")) as Catalog;

function collectLeaves(catalog: Catalog, prefix = ""): Map<string, string> {
  const leaves = new Map<string, string>();
  for (const [key, value] of Object.entries(catalog)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      leaves.set(keyPath, value);
    } else {
      for (const [nestedPath, message] of collectLeaves(value, keyPath)) {
        leaves.set(nestedPath, message);
      }
    }
  }
  return leaves;
}

function placeholderNames(message: string): string[] {
  return [...message.matchAll(/\{(\w+)/g)].map((match) => match[1]).sort();
}

const ARABIC_PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

function isIcuPlural(message: string): boolean {
  return /,\s*plural\s*,/.test(message);
}

function pluralCategoriesPresent(message: string): string[] {
  return ARABIC_PLURAL_CATEGORIES.filter((category) =>
    new RegExp(`(^|\\s)${category}\\s*\\{`).test(message),
  );
}

describe("message catalogs", () => {
  const enLeaves = collectLeaves(en);
  const arLeaves = collectLeaves(ar);

  it("have the same key paths in both locales", () => {
    expect([...arLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
  });

  it("use the same placeholder names on each leaf", () => {
    for (const [key, enMessage] of enLeaves) {
      const arMessage = arLeaves.get(key);
      expect(arMessage, `ar catalog is missing key "${key}"`).toBeDefined();
      expect(placeholderNames(arMessage as string)).toEqual(placeholderNames(enMessage));
    }
  });

  it("gives every Arabic ICU plural all six grammatical categories", () => {
    for (const [key, message] of arLeaves) {
      if (!isIcuPlural(message)) continue;
      expect(pluralCategoriesPresent(message), `ar "${key}" is missing a plural category`).toEqual(
        ARABIC_PLURAL_CATEGORIES,
      );
    }
  });

  it("has a quota plural fixture in both catalogs", () => {
    expect(enLeaves.has("quota")).toBe(true);
    expect(arLeaves.has("quota")).toBe(true);
  });
});

function NumberProbe() {
  const t = useTranslations();
  return createElement("span", null, t("test", { count: 1234 }));
}

function SignupSubtitle() {
  const t = useTranslations("auth.signup");
  return createElement("span", null, t("subtitle", { limit: 3 }));
}

describe("number formatting under the ar locale", () => {
  it("renders Western digits instead of Arabic-Indic digits", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Provider,
        { locale: "ar", messages: { test: "{count, number}" } },
        createElement(NumberProbe),
      ),
    );

    expect(markup.replace(/[^0-9]/g, "")).toContain("1234");
    expect(markup).not.toMatch(/[\u0660-\u0669]/);
  });

  it("uses the Arabic few form for the free signup limit of 3", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Provider,
        { locale: "ar", messages: ar as unknown as Record<string, string> },
        createElement(SignupSubtitle),
      ),
    );

    expect(markup).toContain("3 فواتير شهريًا");
    expect(markup).not.toMatch(/[\u0660-\u0669]/);
  });
});
