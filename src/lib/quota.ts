/** Number of invoices a free-plan user may create per calendar month. */
export const FREE_MONTHLY_LIMIT = 3;

export type QuotaState = {
  isPro: boolean;
  used: number;
  limit: number | null;
  remaining: number;
  /** True when the next invoice creation must be blocked. */
  blocked: boolean;
};

export function getQuotaState(isPro: boolean, usedThisMonth: number): QuotaState {
  if (isPro) {
    return { isPro: true, used: usedThisMonth, limit: null, remaining: Infinity, blocked: false };
  }
  const remaining = Math.max(0, FREE_MONTHLY_LIMIT - usedThisMonth);
  return {
    isPro: false,
    used: usedThisMonth,
    limit: FREE_MONTHLY_LIMIT,
    remaining,
    blocked: remaining === 0,
  };
}

/** First instant of the month containing `now` (server-local time). */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}
