import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import { ClientManager } from "./client-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

vi.mock("@/lib/actions/clients", () => ({
  createClientAction: async () => ({ ok: true }),
  updateClientAction: async () => ({ ok: true }),
  deleteClientAction: async () => ({ ok: true }),
}));

const Provider = NextIntlClientProvider as unknown as (props: {
  locale: string;
  messages: Record<string, unknown>;
  children?: ReactNode;
}) => ReactElement;

const messages = JSON.parse(
  readFileSync(path.join(process.cwd(), "messages/ar.json"), "utf8"),
) as Record<string, unknown>;

function bdiDir(html: string, text: string): string | undefined {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<bdi dir="(ltr|rtl)">${escaped}</bdi>`))?.[1];
}

it("gives a stored client name and phone address their own direction inside an Arabic list", () => {
  const html = renderToStaticMarkup(
    createElement(
      Provider,
      { locale: "ar", messages },
      createElement(ClientManager, {
        clients: [
          {
            id: "c1",
            userId: "u1",
            name: "مكتب",
            email: "owner@example.com",
            address: "+20 100 123 4567",
            invoiceCount: 1,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          },
        ],
      }),
    ),
  );

  expect(bdiDir(html, "مكتب")).toBe("rtl");
  expect(bdiDir(html, "+20 100 123 4567")).toBe("ltr");
});
