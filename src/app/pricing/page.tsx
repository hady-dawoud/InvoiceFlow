import type { Metadata } from "next";
import { LanguageSwitcher } from "@/components/language-switcher";
import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { withProAccess } from "@/lib/session";
import { formatWalletAmount, WALLET_PLANS } from "@/lib/wallet-billing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.pricing");
  const price = await getTranslations("price");
  return {
    title: t("metaTitle"),
    description: t("metaDescription", {
      limit: FREE_MONTHLY_LIMIT,
      price: price("monthly", { amount: formatWalletAmount(WALLET_PLANS[0].amountEgp) }),
    }),
  };
}

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user ? withProAccess(session.user) : undefined;
  const t = await getTranslations("marketing.pricing");

  const faq = [
    { q: t("faq.q1"), a: t("faq.a1", { limit: FREE_MONTHLY_LIMIT }) },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
  ];

  const primaryCta = !user
    ? { href: "/signup", label: t("cta.startFree") }
    : user.isPro
      ? { href: "/dashboard/billing", label: t("cta.manageSubscription") }
      : { href: "/dashboard/billing", label: t("cta.upgradeToPro") };

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="wordmark text-2xl">
            InvoiceFlow
          </Link>
          <LanguageSwitcher />
        </div>
        <h1 className="display mt-8 text-4xl text-ink sm:text-5xl">
          {t("heading")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-quiet">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
          <h2 className="text-lg font-medium text-ink">{t("free.name")}</h2>
          <p className="display money mt-2 text-4xl text-ink">
            $0<span className="text-base font-normal text-quiet">{t("freePerMonth")}</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-quiet">
            <li>✓ {t("free.feature1", { limit: FREE_MONTHLY_LIMIT })}</li>
            <li>✓ {t("free.feature2")}</li>
            <li>✓ {t("free.feature3")}</li>
            <li className="text-quiet">✗ {t("free.feature4")}</li>
          </ul>
          {!user && (
            <Link href="/signup" className="btn btn-ghost mt-6 w-full">
              {t("cta.startFree")}
            </Link>
          )}
        </div>

        {WALLET_PLANS.map((plan) => (
          <div key={plan.id} className="bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
            <h2 className="text-lg font-medium text-ink">{t(`terms.${plan.id}.name`)}</h2>
            <p className="display money mt-2 text-4xl text-ink">
              {formatWalletAmount(plan.amountEgp)}
              <span className="text-base font-normal text-quiet"> {t("egp")}</span>
            </p>
            {plan.id !== "1" ? (
              <p className="mt-1 text-sm text-quiet">{t(`terms.${plan.id}.saving`)}</p>
            ) : (
              <p className="mt-1 text-sm text-quiet">{t("pro.name")}</p>
            )}
            <ul className="mt-4 space-y-2 text-sm text-quiet">
              <li>✓ {t("pro.feature1")}</li>
              <li>✓ {t("pro.feature2")}</li>
              <li>✓ {t("pro.feature3")}</li>
              <li>✓ {t("pro.feature4")}</li>
            </ul>
            {user && !user.isPro && (
              <Link href="/dashboard/billing" className="btn mt-6 w-full">
                {t("cta.upgradeToPro")}
              </Link>
            )}
          </div>
        ))}
      </div>

      {user && !user.isPro && (
        <div className="mt-8 text-center">
          <Link
            href={primaryCta.href}
            className="btn"
          >
            {primaryCta.label}
          </Link>
        </div>
      )}

      <section className="mt-16">
        <h2 className="text-center text-xl font-bold text-ink">
          {t("faq.heading")}
        </h2>
        <div className="mx-auto mt-6 max-w-2xl space-y-4">
          {faq.map((item) => (
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
