import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import {
  openCustomerPortalAction,
  upgradeToProAction,
} from "@/lib/actions/billing";
import { isBillingConfigured, isTestMode } from "@/lib/stripe";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.billing");
  return { title: t("metaTitle") };
}

const BANNER_STYLE: Record<string, { messageKey: string; className: string }> = {
  success: { messageKey: "banner.success", className: "text-paid" },
  pending: { messageKey: "banner.pending", className: "text-ink" },
  "existing-subscription": { messageKey: "banner.existingSubscription", className: "text-ink" },
  canceled: { messageKey: "banner.canceled", className: "border-line bg-ink/8 text-quiet" },
  "not-configured": { messageKey: "banner.notConfigured", className: "text-ink" },
  "no-subscription": { messageKey: "banner.noSubscription", className: "text-ink" },
  "checkout-failed": { messageKey: "banner.checkoutFailed", className: "text-overdue" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const session = await getSession();
  const { success, canceled, error } = await searchParams;
  const t = await getTranslations("dashboard.billing");
  const tPlan = await getTranslations("dashboard.plan");

  const bannerKey = success ? (session.user.isPro ? "success" : "pending") : canceled ? "canceled" : error;
  const bannerStyle = bannerKey ? BANNER_STYLE[bannerKey] : undefined;
  const banner = bannerStyle
    ? { text: t(bannerStyle.messageKey), className: bannerStyle.className }
    : undefined;

  const configured = isBillingConfigured();

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
            <p className="mt-1 text-sm text-quiet">
              {session.user.isPro
                ? session.user.proSince
                  ? t("unlimitedSince", { date: session.user.proSince.toISOString().slice(0, 10) })
                  : t("unlimitedInvoices")
                : t("freeLimit", { limit: FREE_MONTHLY_LIMIT })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          {session.user.stripeCustomerId && (
            <form action={openCustomerPortalAction}>
              <button
                className="btn btn-ghost"
                disabled={!configured}
              >
                {t("manageSubscription")}
              </button>
            </form>
          )}
          {!session.user.isPro && (
            <form action={upgradeToProAction}>
              <button
                className="btn"
                disabled={!configured}
              >
                {t("upgradeToPro", { price: PRO_MONTHLY_PRICE_LABEL })}
              </button>
            </form>
          )}
          </div>
        </div>
        {!configured && (
          <p className="notice mt-4 text-sm">
            {t("notConfiguredNotice")}
          </p>
        )}
        {configured && isTestMode() && (
          <p className="notice mt-4 text-sm">
            {t.rich("testMode", {
              strong: (chunks) => <strong>{chunks}</strong>,
              card: "4242 4242 4242 4242",
            })}
          </p>
        )}
      </div>

      <div className="bg-sheet p-6 text-sm text-quiet shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <h2 className="font-semibold text-ink">{t("pro.heading")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t("pro.unlimitedFeature", { limit: FREE_MONTHLY_LIMIT })}</li>
          <li>{t("pro.pdfFeature")}</li>
          <li>{t("pro.trackingFeature")}</li>
        </ul>
        <p className="mt-3 text-xs text-quiet">
          {t("pro.cancelNote")}
        </p>
      </div>
    </div>
  );
}
