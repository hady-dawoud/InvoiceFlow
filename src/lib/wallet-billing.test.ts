import { describe, expect, it } from "vitest";
import {
  activationAuthorized,
  deliverWalletNotice,
  extendProUntil,
  parseWalletSubmission,
  paymentNotice,
  proIsActive,
  walletChannels,
  walletPlan,
} from "./wallet-billing";

const now = new Date("2026-10-15T12:00:00.000Z");

describe("prepaid terms", () => {
  it.each([
    ["1", 1, 500],
    ["6", 6, 2500],
    ["12", 12, 4500],
  ])("plan %s lasts %i months and costs %i EGP", (id, months, amountEgp) => {
    expect(walletPlan(id)).toMatchObject({ months, amountEgp });
  });

  it("rejects an unknown term", () => {
    expect(walletPlan("3")).toBeNull();
  });

  it.each([
    ["2026-01-31T00:00:00.000Z", 1, "2026-02-28T00:00:00.000Z"],
    ["2024-01-31T00:00:00.000Z", 1, "2024-02-29T00:00:00.000Z"],
    ["2026-10-15T12:00:00.000Z", 12, "2027-10-15T12:00:00.000Z"],
  ])("adds months without rolling past the last day (%s + %i)", (start, months, end) => {
    expect(extendProUntil(null, new Date(start), months).toISOString()).toBe(end);
  });

  it("extends a term that has not ended yet from its current end", () => {
    const current = new Date("2026-12-01T00:00:00.000Z");
    expect(extendProUntil(current, now, 6).toISOString()).toBe("2027-06-01T00:00:00.000Z");
  });

  it("starts a lapsed term from today", () => {
    const current = new Date("2026-01-01T00:00:00.000Z");
    expect(extendProUntil(current, now, 1).toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });
});

describe("pro access", () => {
  it.each([
    [true, null, true],
    [false, null, false],
    [true, "2026-10-15T12:00:00.000Z", false],
    [true, "2026-10-15T12:00:01.000Z", true],
  ] as const)("isPro %s until %s is active=%s", (isPro, until, active) => {
    expect(proIsActive({ isPro, proUntil: until ? new Date(until) : null }, now)).toBe(active);
  });
});

describe("payment submission", () => {
  it("accepts InstaPay or Orange Cash with the pasted confirmation", () => {
    expect(parseWalletSubmission({
      plan: "6",
      method: "orange_cash",
      confirmation: "  Orange Cash ref 88421  ",
    })).toEqual({
      ok: true,
      plan: { id: "6", months: 6, amountEgp: 2500 },
      method: "orange_cash",
      confirmation: "Orange Cash ref 88421",
    });
    expect(parseWalletSubmission({ plan: "1", method: "instapay", confirmation: "12345678" })).toMatchObject({ ok: true });
  });

  it.each([
    [{ plan: "3", method: "instapay", confirmation: "transfer 12345678" }, "plan"],
    [{ plan: "1", method: "vodafone", confirmation: "transfer 12345678" }, "method"],
    [{ plan: "1", method: "instapay", confirmation: "  short  " }, "confirmation"],
    [{ plan: "12", method: "instapay", confirmation: "x".repeat(2001) }, "confirmation"],
  ])("rejects %j because of %s", (input, reason) => {
    expect(parseWalletSubmission(input)).toEqual({ ok: false, reason });
  });
});

describe("owner notification", () => {
  const notice = {
    requestId: "req-1",
    userId: "user-1",
    email: "owner@example.com",
    method: "instapay" as const,
    months: 1,
    amountEgp: 500,
    confirmation: "InstaPay 998877 from Ahmed",
  };

  it("puts the request id and the pasted confirmation in the message the bot reads", () => {
    expect(paymentNotice(notice)).toBe([
      "InvoiceFlow payment confirmation",
      "request_id: req-1",
      "user_id: user-1",
      "email: owner@example.com",
      "method: instapay",
      "months: 1",
      "amount_egp: 500",
      "---",
      "InstaPay 998877 from Ahmed",
    ].join("\n"));
  });

  it("sends the same message to each configured channel", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response("ok", { status: 200 });
    };
    await deliverWalletNotice(paymentNotice(notice), [
      { type: "slack", url: "https://hooks.slack.test/abc" },
      { type: "telegram", token: "bot-token", chatId: "42" },
    ], fetchImpl);
    expect(calls).toEqual([
      { url: "https://hooks.slack.test/abc", body: { text: paymentNotice(notice) } },
      {
        url: "https://api.telegram.org/botbot-token/sendMessage",
        body: { chat_id: "42", text: paymentNotice(notice) },
      },
    ]);
  });

  it("fails when a channel rejects the message", async () => {
    const fetchImpl: typeof fetch = async () => new Response("no", { status: 500 });
    await expect(deliverWalletNotice("hello", [{ type: "slack", url: "https://hooks.slack.test/abc" }], fetchImpl))
      .rejects.toThrow("notify");
  });

  it("reads Slack and Telegram from the environment only when each one is complete", () => {
    expect(walletChannels({
      SLACK_BILLING_WEBHOOK_URL: " https://hooks.slack.test/abc ",
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_BILLING_CHAT_ID: "",
    })).toEqual([{ type: "slack", url: "https://hooks.slack.test/abc" }]);
    expect(walletChannels({})).toEqual([]);
  });
});

describe("activation secret", () => {
  it.each([
    ["Bearer secret-value", "secret-value", true],
    ["Bearer other-value", "secret-value", false],
    ["secret-value", "secret-value", false],
    ["Bearer secret-value", undefined, false],
  ] as const)("header %j with secret %j is authorized=%s", (header, secret, authorized) => {
    expect(activationAuthorized(header, secret)).toBe(authorized);
  });
});
