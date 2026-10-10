import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import { formatCents } from "@/lib/money";
import { InvoiceDocument, LtrBdi } from "./invoice-document";

const Provider = NextIntlClientProvider as unknown as (props: {
  locale: string;
  messages: Catalog;
  children?: ReactNode;
}) => ReactElement;

type Catalog = { [key: string]: Catalog | string };

const messagesDir = path.join(process.cwd(), "messages");
const en = JSON.parse(readFileSync(path.join(messagesDir, "en.json"), "utf8")) as Catalog;
const ar = JSON.parse(readFileSync(path.join(messagesDir, "ar.json"), "utf8")) as Catalog;

function leaf(catalog: Catalog, keyPath: string): string {
  const value = keyPath.split(".").reduce<Catalog | string>((node, key) => {
    if (typeof node === "string") throw new Error(`missing ${keyPath}`);
    return node[key];
  }, catalog);
  if (typeof value !== "string") throw new Error(`missing ${keyPath}`);
  return value;
}

function bdiDir(html: string, text: string): string | undefined {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<bdi dir="(ltr|rtl)">${escaped}</bdi>`))?.[1];
}

const invoice = {
  number: "INV-1",
  status: "draft" as const,
  issueDate: "2026-10-10",
  dueDate: "2026-10-10",
  taxBps: 0,
  notes: "Thank you",
  documentLocale: "ar" as const,
};

const sheetProps = {
  invoice,
  client: { name: "Acme", email: "owner@example.com", address: null },
  items: [{ description: "Design", quantity: 1, unitPriceCents: 5000 }],
  businessName: "مكتب",
  businessEmail: "studio@example.com",
  currency: "usd",
};

async function renderSheet() {
  const node = await InvoiceDocument(sheetProps);
  return renderToStaticMarkup(createElement(Provider, { locale: "en", messages: en }, node));
}

it("uses document-locale labels and ltr bidi for amounts, dates, and the invoice number", async () => {
  const html = await renderSheet();

  expect(html).toContain('lang="ar"');
  expect(html).toContain('dir="rtl"');
  expect(html).not.toContain('dir="auto"');
  expect(html).toContain(leaf(ar, "invoice.document.totalDue"));
  expect(html).not.toContain(leaf(en, "invoice.document.totalDue"));
  expect(html).toContain(leaf(ar, "invoice.status.draft"));
  expect(html).not.toContain(leaf(en, "invoice.status.draft"));
  expect(bdiDir(html, "$50.00")).toBe("ltr");
  expect(bdiDir(html, "INV-1")).toBe("ltr");
  expect(bdiDir(html, "2026-10-10")).toBe("ltr");
  expect(bdiDir(html, "Acme")).toBe("ltr");
  expect(bdiDir(html, "مكتب")).toBe("rtl");
  expect(bdiDir(html, "Thank you")).toBe("ltr");
});

it("keeps the Arabic tax percent in an ltr bdi", async () => {
  const node = await InvoiceDocument({
    ...sheetProps,
    invoice: { ...invoice, taxBps: 850 },
  });
  const html = renderToStaticMarkup(createElement(Provider, { locale: "en", messages: en }, node));

  expect(html).toContain("الضريبة");
  expect(bdiDir(html, "(8.5%)")).toBe("ltr");
});

it("keeps a leading minus on an ltr amount bdi inside rtl", () => {
  const html = renderToStaticMarkup(
    createElement("div", { dir: "rtl" }, createElement(LtrBdi, { value: formatCents(-5000, "usd") })),
  );

  expect(html).toContain("-$50.00");
  expect(bdiDir(html, "-$50.00")).toBe("ltr");
});
