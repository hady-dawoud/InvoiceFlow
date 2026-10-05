import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isBillingConfigured, isTestMode } from "@/lib/stripe";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";

export const metadata = {
  title: "Pricing — simple plans for freelancers",
  description:
    `Start free with ${FREE_MONTHLY_LIMIT} invoices a month. Upgrade to Pro for ${PRO_MONTHLY_PRICE_LABEL}/month for unlimited invoices, PDF export and payment tracking.`,
};

const FAQ = [
  {
    q: "Is the free plan really free?",
    a: `Yes — no card required. You can create up to ${FREE_MONTHLY_LIMIT} invoices every calendar month.`,
  },
  {
    q: "What counts as an invoice?",
    a: "Any invoice you save, draft or sent. Deleting an invoice does not restore monthly quota.",
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
      <div>
        <Link href="/" className="wordmark text-2xl">
          InvoiceFlow
        </Link>
        <h1 className="display mt-8 text-4xl text-ink sm:text-5xl">
          Simple pricing for freelancers
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-quiet">
          Start free. Upgrade when your client list grows. Cancel anytime.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
          <h2 className="text-lg font-medium text-ink">Free</h2>
          <p className="display money mt-2 text-4xl text-ink">
            $0<span className="text-base font-normal text-quiet">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-quiet">
            <li>✓ {FREE_MONTHLY_LIMIT} invoices per month</li>
            <li>✓ Client management</li>
            <li>✓ Shareable invoice links</li>
            <li className="text-quiet">✗ PDF export</li>
          </ul>
          {!user && (
            <Link
              href="/signup"
              className="btn btn-ghost mt-6 w-full"
            >
              Start for free
            </Link>
          )}
        </div>

        <div className="bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
          <h2 className="text-lg font-medium text-ink">Pro</h2>
          <p className="display money mt-2 text-4xl text-ink">
            {PRO_MONTHLY_PRICE_LABEL}<span className="text-base font-normal text-quiet">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-quiet">
            <li>✓ Unlimited invoices</li>
            <li>✓ PDF export</li>
            <li>✓ Payment &amp; overdue tracking</li>
            <li>✓ Priority support</li>
          </ul>
          {user && !user.isPro && configured && (
            <Link
              href="/dashboard/billing"
              className="btn mt-6 w-full"
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
            className="btn"
          >
            {primaryCta.label}
          </Link>
          {configured && isTestMode() && (
            <p className="mt-2 text-xs text-quiet">
              Test mode active — card 4242 4242 4242 4242, no real charge.
            </p>
          )}
        </div>
      )}

      <section className="mt-16">
        <h2 className="text-center text-xl font-bold text-ink">
          Frequently asked questions
        </h2>
        <div className="mx-auto mt-6 max-w-2xl space-y-4">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="rounded-xl border border-line bg-white px-4 py-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-quiet">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
