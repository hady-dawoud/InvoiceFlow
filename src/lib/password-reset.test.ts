import { describe, expect, it } from "vitest";
import { deliverPasswordReset, passwordResetConfigured } from "./password-reset";

const configured = { RESEND_API_KEY: "re_test", EMAIL_FROM: "InvoiceFlow <mail@example.com>" };

describe("password reset email", () => {
  it.each([
    [{}, false],
    [{ RESEND_API_KEY: "re_test" }, false],
    [{ EMAIL_FROM: "mail@example.com" }, false],
    [configured, true],
  ])("is configured only when both the key and the from address are set", (env, expected) => {
    expect(passwordResetConfigured(env)).toBe(expected);
  });

  it("refuses to send when email delivery is not configured", async () => {
    await expect(deliverPasswordReset({ to: "owner@example.com", url: "https://example.com/reset" }, {})).rejects.toThrow(
      "password-reset-not-configured",
    );
  });

  it("sends the reset link and fails when the provider rejects it", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return new Response("no", { status: 422 });
    };
    await expect(
      deliverPasswordReset({ to: "owner@example.com", url: "https://example.com/reset?token=abc" }, configured, fetchImpl),
    ).rejects.toThrow("422");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(calls[0].body)).toMatchObject({
      from: configured.EMAIL_FROM,
      to: ["owner@example.com"],
      text: expect.stringContaining("https://example.com/reset?token=abc"),
    });
  });
});
