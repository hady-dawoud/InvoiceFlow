import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isBillingConfigured, isTestMode } from "@/lib/stripe";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";

export const metadata = {
  title: "Pricing — simple plans for freelancers",
  description:
    "Start free with 3 invoices a month. Upgrade to Pro for $9/month for unlimited invoices, PDF export and payment tracking.",
};

const FAQ = [
  {
    q: "Is the free plan really free?",
    a: "Yes — no card required. You can create up to 3 invoices every calendar month, forever.",
  },
  {
    q: "What counts as an invoice?",
    a: "Any invoice you save, draft or sent. Deleting one frees up your monthly quota again.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yes, from the billing page in one click. You keep Pro until the end of the period; your invoices remain accessible on the free plan.",
  },
  {
    q: "Do you take a cut of my invoice amounts?",
    a: "Never. InvoiceFlow is a flat subscription — what your client pays is yours.",
  },
];

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  const configured = isBillingConfigured();

  const primaryCta = !user
    ? { href: "/signup", label: "Start for free" }
    : user.isPro
      ? { href: "/dashboard/billing", label: "Manage subscription" }
      : configured
        ? { href: "/dashboard/billing", label: "Upgrade to Pro" }
        : { href: "/dashboard/billing", label: "Billing not configured" };

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← InvoiceFlow
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Simple pricing for freelancers
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Start free. Upgrade when your client list grows. Cancel anytime.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Free</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            $0<span className="text-base font-normal text-slate-500">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>✓ {FREE_MONTHLY_LIMIT} invoices per month</li>
            <li>✓ Client management</li>
            <li>✓ Shareable invoice links</li>
            <li className="text-slate-400">✗ PDF export</li>
          </ul>
          {!user && (
            <Link
              href="/signup"
              className="mt-6 block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Start for free
            </Link>
          )}
        </div>

        <div className="relative rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-md">
          <span className="absolute -top-3 left-6 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            Most popular
          </span>
          <h2 className="text-lg font-semibold text-slate-900">Pro</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            $9<span className="text-base font-normal text-slate-500">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>✓ Unlimited invoices</li>
            <li>✓ PDF export</li>
            <li>✓ Payment &amp; overdue tracking</li>
            <li>✓ Priority support</li>
          </ul>
          {user && !user.isPro && configured && (
            <Link
              href="/dashboard/billing"
              className="mt-6 block rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Upgrade to Pro
            </Link>
          )}
        </div>
      </div>

      {user && !user.isPro && (
        <div className="mt-8 text-center">
          <Link
            href={primaryCta.href}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {primaryCta.label}
          </Link>
          {configured && isTestMode() && (
            <p className="mt-2 text-xs text-slate-400">
              Test mode active — card 4242 4242 4242 4242, no real charge.
            </p>
          )}
        </div>
      )}

      <section className="mt-16">
        <h2 className="text-center text-xl font-bold text-slate-900">
          Frequently asked questions
        </h2>
        <div className="mx-auto mt-6 max-w-2xl space-y-4">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
