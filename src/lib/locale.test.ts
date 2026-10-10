import { expect, it } from "vitest";
import { localeCookie, resolveLocale } from "./locale";

it("resolves the UI locale from the cookie and Accept-Language header", () => {
  expect(
    resolveLocale({ cookie: "ar", acceptLanguage: "en-US" }),
  ).toBe("ar");
  expect(
    resolveLocale({ cookie: "nope", acceptLanguage: "en;q=0.5, ar;q=0.8" }),
  ).toBe("ar");
  expect(
    resolveLocale({
      cookie: null,
      acceptLanguage: "en-US,en;q=0.9,ar;q=0.8",
    }),
  ).toBe("en");
  expect(
    resolveLocale({ cookie: null, acceptLanguage: "ar-EG,en;q=0.5" }),
  ).toBe("ar");
  expect(resolveLocale({ cookie: null, acceptLanguage: "AR" })).toBe("ar");
  expect(
    resolveLocale({ cookie: null, acceptLanguage: "arc,en;q=0.8" }),
  ).toBe("en");
  expect(resolveLocale({ cookie: null, acceptLanguage: "" })).toBe("en");
  expect(resolveLocale({ cookie: null, acceptLanguage: "*" })).toBe("en");
  expect(
    resolveLocale({ cookie: null, acceptLanguage: "en;q=0, ar;q=0.1" }),
  ).toBe("ar");
  expect(resolveLocale({ cookie: null, acceptLanguage: "ar-EG" })).toBe("ar");
});

it("builds the UI locale cookie with a one-year lax path-scoped flag", () => {
  expect(localeCookie("ar", { secure: true })).toEqual({
    name: "invoiceflow_locale",
    value: "ar",
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
    secure: true,
  });
  expect(localeCookie("en", { secure: false })).toEqual({
    name: "invoiceflow_locale",
    value: "en",
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
    secure: false,
  });
  expect(() => localeCookie("fr" as "en", { secure: false })).toThrow();
});
