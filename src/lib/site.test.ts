import { afterEach, describe, expect, it } from "vitest";
import { PUBLIC_PATHS, robotsPolicy, sitemapEntries } from "./site";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

describe("public site index", () => {
  it("lists marketing and account pages and hides private ones", () => {
    expect(PUBLIC_PATHS).toEqual(["/", "/pricing", "/login", "/signup"]);
    process.env.APP_URL = "https://invoiceflow.example/";
    expect(robotsPolicy()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api/", "/pay/"],
      },
      sitemap: "https://invoiceflow.example/sitemap.xml",
    });
    expect(sitemapEntries().map((entry) => entry.url)).toEqual([
      "https://invoiceflow.example",
      "https://invoiceflow.example/pricing",
      "https://invoiceflow.example/login",
      "https://invoiceflow.example/signup",
    ]);
  });
});
