import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import { OverdueNote } from "./overdue-note";

const Provider = NextIntlClientProvider as unknown as (props: {
  locale: string;
  messages: Record<string, unknown>;
  children?: ReactNode;
}) => ReactElement;

const messages = JSON.parse(
  readFileSync(path.join(process.cwd(), "messages/ar.json"), "utf8"),
) as Record<string, unknown>;

it("keeps an overdue amount in an ltr bdi inside the Arabic sentence", () => {
  const html = renderToStaticMarkup(
    createElement(
      "div",
      { dir: "rtl" },
      createElement(
        Provider,
        { locale: "ar", messages },
        createElement(OverdueNote, { amount: "$50.00" }),
      ),
    ),
  );

  expect(html).toContain('<bdi dir="ltr">$50.00</bdi>');
  expect(html).toContain("مبلغ متأخر قدره");
});
