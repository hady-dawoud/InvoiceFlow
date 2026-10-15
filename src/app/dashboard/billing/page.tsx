import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CopyNumber } from "@/components/copy-number";
import { openCustomerPortalAction, submitWalletPaymentAction } from "@/lib/actions/billing";
import { isBillingConfigured } from "@/lib/stripe";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { getSession } from "@/lib/session";
import {
  formatWalletAmount,
  WALLET_NUMBER,
  WALLET_PLANS,
  walletChannels,
} from "@/lib/wallet-billing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.billing");
  return { title: t("metaTitle") };
}

const BANNER_STYLE: Record<string, { messageKey: string; className: string }> = {
  success: { messageKey: "banner.success", className: "text-paid" },
  sent: { messageKey: "banner.sent", className: "text-ink" },
  pending: { messageKey: "banner.pending", className: "text-ink" },
  "existing-subscription": { messageKey: "banner.existingSubscription", className: "text-ink" },
  canceled: { messageKey: "banner.canceled", className: "border-line bg-ink/8 text-quiet" },
  "not-configured": { messageKey: "banner.notConfigured", className: "text-ink" },
  "no-subscription": { messageKey: "banner.noSubscription", className: "text-ink" },
  "checkout-failed": { messageKey: "banner.checkoutFailed", className: "text-overdue" },
  notify: { messageKey: "banner.notify", className: "text-overdue" },
  invalid: { messageKey: "banner.invalid", className: "text-overdue" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; sent?: string; error?: string }>;
}) {
  const session = await getSession();
  const { success, canceled, sent, error } = await searchParams;
  const t = await getTranslations("dashboard.billing");
  const tPlan = await getTranslations("dashboard.plan");
  const payable = walletChannels(process.env).length > 0;
  const openEnded = session.user.isPro && session.user.proUntil == null;

  const bannerKey = sent ? "sent" : success ? (session.user.isPro ? "success" : "pending") : canceled ? "canceled" : error;
  const bannerStyle = bannerKey ? BANNER_STYLE[bannerKey] : undefined;
  const banner = bannerStyle
    ? { text: t(bannerStyle.messageKey), className: bannerStyle.className }
    : undefined;

  const planDetail = session.user.isPro
    ? session.user.proUntil
      ? t("unlimitedUntil", { date: session.user.proUntil.toISOString().slice(0, 10) })
      : session.user.proSince
        ? t("unlimitedSince", { date: session.user.proSince.toISOString().slice(0, 10) })
        : t("unlimitedInvoices")
    : t("freeLimit", { limit: FREE_MONTHLY_LIMIT });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="display text-3xl text-ink">{t("heading")}</h1>

      {banner && (
        <p className={`notice text-sm ${banner.className}`}>
          {banner.text}
        </p>
      )}

      <div className="bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-quiet">{t("currentPlanLabel")}</p>
            <p className="display mt-1 text-4xl text-ink">
              {session.user.isPro ? tPlan("pro") : tPlan("free")}
            </p>
            <p className="mt-1 text-sm text-quiet">{planDetail}</p>
          </div>
          {session.user.stripeCustomerId && (
            <form action={openCustomerPortalAction}>
              <button className="btn btn-ghost" disabled={!isBillingConfigured()}>
                {t("manageSubscription")}
              </button>
            </form>
          )}
        </div>
      </div>

      {!openEnded && (
        <form action={submitWalletPaymentAction} className="bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
          <h2 className="text-lg font-medium text-ink">{t("wallet.heading")}</h2>
          <p className="mt-2 max-w-prose text-sm text-quiet">{t("wallet.body")}</p>

          <fieldset className="mt-5 space-y-2">
            <legend className="text-sm font-medium text-ink">{t("wallet.termLegend")}</legend>
            {WALLET_PLANS.map((plan) => {
              const amount = formatWalletAmount(plan.amountEgp);
              const label = plan.id === "1"
                ? t("wallet.termMonth", { amount })
                : plan.id === "6"
                  ? t("wallet.termHalf", { amount })
                  : t("wallet.termYear", { amount });
              const saving = plan.id === "6" ? t("wallet.savingHalf") : plan.id === "12" ? t("wallet.savingYear") : null;
              return (
              <label key={plan.id} className="flex items-baseline justify-between gap-3 border border-line bg-white px-3 py-2">
                <span className="flex items-center gap-2">
                  <input className="size-4" type="radio" name="plan" value={plan.id} required />
                  <span>{label}</span>
                </span>
                {saving ? <span className="text-sm text-quiet">{saving}</span> : null}
              </label>
              );
            })}
          </fieldset>

          <fieldset className="mt-5 space-y-2">
            <legend className="text-sm font-medium text-ink">{t("wallet.methodLegend")}</legend>
            <label className="flex items-center gap-2 border border-line bg-white px-3 py-2">
              <input className="size-4" type="radio" name="method" value="instapay" required />
              {t("wallet.instapay")}
            </label>
            <label className="flex items-center gap-2 border border-line bg-white px-3 py-2">
              <input className="size-4" type="radio" name="method" value="orange_cash" required />
              {t("wallet.orangeCash")}
            </label>
          </fieldset>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-quiet">{t("wallet.numberLabel")}</p>
              <p className="display money text-3xl text-ink" dir="ltr">
                <bdi>{WALLET_NUMBER}</bdi>
              </p>
            </div>
            <CopyNumber value={WALLET_NUMBER} label={t("wallet.copy")} copiedLabel={t("wallet.copied")} />
          </div>

          <label className="mt-5 block text-sm font-medium text-ink">
            {t("wallet.confirmationLabel")}
            <textarea
              name="confirmation"
              required
              minLength={8}
              maxLength={2000}
              rows={4}
              className="field mt-2"
              placeholder={t("wallet.confirmationHint")}
            />
          </label>

          <button className="btn mt-4" disabled={!payable}>
            {t("wallet.submit")}
          </button>
          {!payable && <p className="notice mt-4 text-sm">{t("notConfiguredNotice")}</p>}
        </form>
      )}

      <div className="bg-sheet p-6 text-sm text-quiet shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <h2 className="font-semibold text-ink">{t("pro.heading")}</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>{t("pro.unlimitedFeature", { limit: FREE_MONTHLY_LIMIT })}</li>
          <li>{t("pro.pdfFeature")}</li>
          <li>{t("pro.trackingFeature")}</li>
        </ul>
        <p className="mt-3 text-xs text-quiet">{t("pro.cancelNote")}</p>
      </div>
    </div>
  );
}
