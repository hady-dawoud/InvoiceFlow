import { expect, it, vi } from "vitest";
import { checkoutLocale, createPortalSession, portalLocale } from "./stripe-locale";

it("sends Checkout en only for an explicit en cookie", () => {
  expect(checkoutLocale({ cookie: "en", locale: "en" })).toBe("en");
  expect(checkoutLocale({ cookie: null, locale: "en" })).toBe("auto");
  expect(checkoutLocale({ cookie: "ar", locale: "ar" })).toBe("auto");
});

it("sends a portal locale only when it is on that API allow-list", () => {
  expect(portalLocale({ cookie: "en", locale: "en" }, ["en", "auto"])).toBe("en");
  expect(portalLocale({ cookie: null, locale: "ar" }, ["en", "ar", "auto"])).toBe("ar");
  expect(portalLocale({ cookie: "ar", locale: "ar" }, ["en", "auto"])).toBe("auto");
  expect(portalLocale({ cookie: null, locale: "en" }, ["en", "ar", "auto"])).toBe("auto");
});

it("retries a portal session once when Stripe rejects the locale", async () => {
  const create = vi
    .fn()
    .mockRejectedValueOnce({ type: "invalid_request_error", param: "locale" })
    .mockResolvedValueOnce("ok");

  await expect(createPortalSession("ar", create)).resolves.toBe("ok");
  expect(create).toHaveBeenCalledTimes(2);
  expect(create).toHaveBeenNthCalledWith(2, "auto");
});

it("does not retry a portal error that is not a locale rejection", async () => {
  const error = { type: "invalid_request_error", param: "customer" };
  const create = vi.fn().mockRejectedValueOnce(error);

  await expect(createPortalSession("en", create)).rejects.toBe(error);
  expect(create).toHaveBeenCalledTimes(1);
});
