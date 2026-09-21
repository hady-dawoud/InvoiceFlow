import Link from "next/link";
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
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  canceled: {
    text: "Checkout canceled — no charge was made.",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
  "not-configured": {
    text: "Billing is not configured on this server yet. Set STRIPE_SECRET_KEY in your environment (test keys are fine).",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  "no-subscription": {
    text: "You don't have an active subscription yet, so there's nothing to manage.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  "checkout-failed": {
    text: "Stripe did not return a checkout URL. Check your Stripe keys and price configuration.",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const session = await getSession();
  const { success, canceled, error } = await searchParams;
  const bannerKey = success ? "success" : canceled ? "canceled" : error;
  const banner = bannerKey ? BANNER[bannerKey] : undefined;

  const configured = isBillingConfigured();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Billing</h1>

      {banner && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${banner.className}`}>
          {banner.text}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {session.user.isPro ? "Pro" : "Free"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {session.user.isPro
                ? `Unlimited invoices${session.user.proSince ? ` · since ${session.user.proSince.toISOString().slice(0, 10)}` : ""}`
                : `${FREE_MONTHLY_LIMIT} invoices per calendar month`}
            </p>
          </div>
          {session.user.isPro ? (
            <form action={openCustomerPortalAction}>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={!configured}
              >
                Manage subscription
              </button>
            </form>
          ) : (
            <form action={upgradeToProAction}>
              <button
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                disabled={!configured}
              >
                Upgrade to Pro — $9/mo
              </button>
            </form>
          )}
        </div>
        {!configured && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Billing is not configured on this machine. Add your Stripe keys to{" "}
            <code className="rounded bg-amber-100 px-1">.env</code> (test mode works) and
            restart the dev server. See{" "}
            <Link href="/dashboard/billing" className="underline">
              docs/DEPLOY.md
            </Link>
            .
          </p>
        )}
        {configured && isTestMode() && (
          <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Stripe <strong>test mode</strong> is active — use card 4242 4242 4242 4242,
            any future expiry, any CVC. No real charges.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <h2 className="font-semibold text-slate-900">What you get with Pro</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Unlimited invoices (free plan: {FREE_MONTHLY_LIMIT}/month)</li>
          <li>PDF export for sending to clients</li>
          <li>Payment tracking dashboard</li>
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Cancel anytime from the customer portal. Your invoices stay accessible on the
          free plan.
        </p>
      </div>
    </div>
  );
}
