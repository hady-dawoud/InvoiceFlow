import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import {
  openCustomerPortalAction,
  upgradeToProAction,
} from "@/lib/actions/billing";
import { isBillingConfigured, isTestMode } from "@/lib/stripe";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { getSession } from "@/lib/session";

export const metadata = { title: "Billing" };

const BANNER: Record<string, { text: string; className: string }> = {
  success: {
    text: "Welcome to Pro! Your subscription is active — enjoy unlimited invoices.",
    className: "text-paid",
  },
  pending: {
    text: "Checkout received. Activation is pending payment confirmation. Refresh this page to check your plan.",
    className: "text-ink",
  },
  "existing-subscription": {
    text: "You already have a subscription. Manage it using the customer portal.",
    className: "text-ink",
  },
  canceled: {
    text: "Checkout canceled — no charge was made.",
    className: "border-line bg-ink/8 text-quiet",
  },
  "not-configured": {
    text: "Billing is not configured on this server yet. Please try again once billing is available.",
    className: "text-ink",
  },
  "no-subscription": {
    text: "You don't have an active subscription yet, so there's nothing to manage.",
    className: "text-ink",
  },
  "checkout-failed": {
    text: "Checkout could not be started. Please try again later.",
    className: "text-overdue",
  },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const session = await getSession();
  const { success, canceled, error } = await searchParams;
  const bannerKey = success ? (session.user.isPro ? "success" : "pending") : canceled ? "canceled" : error;
  const banner = bannerKey ? BANNER[bannerKey] : undefined;

  const configured = isBillingConfigured();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="display text-3xl text-ink">Billing</h1>

      {banner && (
        <p className={`notice text-sm ${banner.className}`}>
          {banner.text}
        </p>
      )}

      <div className="bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-quiet">Current plan</p>
            <p className="display mt-1 text-4xl text-ink">
              {session.user.isPro ? "Pro" : "Free"}
            </p>
            <p className="mt-1 text-sm text-quiet">
              {session.user.isPro
                ? `Unlimited invoices${session.user.proSince ? ` · since ${session.user.proSince.toISOString().slice(0, 10)}` : ""}`
                : `${FREE_MONTHLY_LIMIT} invoices per calendar month`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          {session.user.stripeCustomerId && (
            <form action={openCustomerPortalAction}>
              <button
                className="btn btn-ghost"
                disabled={!configured}
              >
                Manage subscription
              </button>
            </form>
          )}
          {!session.user.isPro && (
            <form action={upgradeToProAction}>
              <button
                className="btn"
                disabled={!configured}
              >
                Upgrade to Pro — {PRO_MONTHLY_PRICE_LABEL}/mo
              </button>
            </form>
          )}
          </div>
        </div>
        {!configured && (
          <p className="notice mt-4 text-sm">
            Billing is not configured. Your current plan and invoices remain accessible.
          </p>
        )}
        {configured && isTestMode() && (
          <p className="notice mt-4 text-sm">
            Stripe <strong>test mode</strong> is active — use card 4242 4242 4242 4242,
            any future expiry, any CVC. No real charges.
          </p>
        )}
      </div>

      <div className="bg-sheet p-6 text-sm text-quiet shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <h2 className="font-semibold text-ink">What you get with Pro</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Unlimited invoices (free plan: {FREE_MONTHLY_LIMIT}/month)</li>
          <li>PDF export for sending to clients</li>
          <li>Payment tracking dashboard</li>
        </ul>
        <p className="mt-3 text-xs text-quiet">
          Cancel anytime from the customer portal. Your invoices stay accessible on the
          free plan.
        </p>
      </div>
    </div>
  );
}
