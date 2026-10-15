import { createHash, timingSafeEqual } from "node:crypto";

export const WALLET_NUMBER = "+201274026227";

export const WALLET_PLANS = [
  { id: "1", months: 1, amountEgp: 500 },
  { id: "6", months: 6, amountEgp: 2500 },
  { id: "12", months: 12, amountEgp: 4500 },
] as const;

export type WalletPlan = (typeof WALLET_PLANS)[number];
export type WalletMethod = "instapay" | "orange_cash";
export type WalletChannel =
  | { type: "slack"; url: string }
  | { type: "telegram"; token: string; chatId: string };

const METHODS = new Set<string>(["instapay", "orange_cash"]);
const CONFIRMATION_MIN = 8;
const CONFIRMATION_MAX = 2000;

export function walletPlan(id: string): WalletPlan | null {
  return WALLET_PLANS.find((plan) => plan.id === id) ?? null;
}

export function formatWalletAmount(amount: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(amount);
}

/** Adds calendar months in UTC, clamping to the last day of the target month. */
export function extendProUntil(current: Date | null, now: Date, months: number): Date {
  const start = current && current.getTime() > now.getTime() ? current : now;
  const day = start.getUTCDate();
  const result = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + months,
    1,
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  ));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * A term end date limits access. Open-ended Pro (no end date) follows `isPro`,
 * which is how Stripe subscriptions and the demo account stay active.
 */
export function proIsActive(account: { isPro: boolean; proUntil: Date | null }, now: Date): boolean {
  if (account.proUntil) return account.proUntil.getTime() > now.getTime();
  return account.isPro;
}

export function parseWalletSubmission(input: {
  plan: unknown;
  method: unknown;
  confirmation: unknown;
}):
  | { ok: true; plan: WalletPlan; method: WalletMethod; confirmation: string }
  | { ok: false; reason: "plan" | "method" | "confirmation" } {
  const plan = walletPlan(typeof input.plan === "string" ? input.plan : "");
  if (!plan) return { ok: false, reason: "plan" };
  if (typeof input.method !== "string" || !METHODS.has(input.method)) return { ok: false, reason: "method" };
  const confirmation = typeof input.confirmation === "string" ? input.confirmation.trim() : "";
  if (confirmation.length < CONFIRMATION_MIN || confirmation.length > CONFIRMATION_MAX) {
    return { ok: false, reason: "confirmation" };
  }
  return { ok: true, plan, method: input.method as WalletMethod, confirmation };
}

export function paymentNotice(input: {
  requestId: string;
  userId: string;
  email: string;
  method: WalletMethod;
  months: number;
  amountEgp: number;
  confirmation: string;
}): string {
  return [
    "InvoiceFlow payment confirmation",
    `request_id: ${input.requestId}`,
    `user_id: ${input.userId}`,
    `email: ${input.email}`,
    `method: ${input.method}`,
    `months: ${input.months}`,
    `amount_egp: ${input.amountEgp}`,
    "---",
    input.confirmation,
  ].join("\n");
}

export function walletChannels(env: Record<string, string | undefined>): WalletChannel[] {
  const channels: WalletChannel[] = [];
  const slack = env.SLACK_BILLING_WEBHOOK_URL?.trim();
  if (slack) channels.push({ type: "slack", url: slack });
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_BILLING_CHAT_ID?.trim();
  if (token && chatId) channels.push({ type: "telegram", token, chatId });
  return channels;
}

export async function deliverWalletNotice(
  message: string,
  channels: WalletChannel[],
  fetchImpl: typeof fetch,
): Promise<void> {
  if (channels.length === 0) throw new Error("notify");
  const results = await Promise.all(channels.map(async (channel) => {
    const response = channel.type === "slack"
      ? await fetchImpl(channel.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: message }),
        })
      : await fetchImpl(`https://api.telegram.org/bot${channel.token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: channel.chatId, text: message }),
        });
    return response.ok;
  }));
  if (results.some((ok) => !ok)) throw new Error("notify");
}

export function activationAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = createHash("sha256").update(header.slice("Bearer ".length)).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}
