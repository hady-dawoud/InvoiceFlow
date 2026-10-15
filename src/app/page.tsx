import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { formatCents } from "@/lib/money";
import { formatWalletAmount, WALLET_PLANS } from "@/lib/wallet-billing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.home");
  return {
    // `absolute` bypasses the root layout's `%s · InvoiceFlow` title template —
    // this title already includes the brand name, matching the layout's prior
    // static `title.default` behavior (used verbatim, no template suffix).
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
  };
}

export default async function LandingPage() {
  const tNav = await getTranslations("marketing.nav");
  const tPrice = await getTranslations("price");
  const proPrice = tPrice("monthly", { amount: formatWalletAmount(WALLET_PLANS[0].amountEgp) });
  const t = await getTranslations("marketing.home");

  const steps = [
    { n: "1", title: t("steps.step1.title"), body: t("steps.step1.body") },
    { n: "2", title: t("steps.step2.title"), body: t("steps.step2.body") },
    { n: "3", title: t("steps.step3.title"), body: t("steps.step3.body") },
  ];

  return (
    <div>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
        <Link href="/" className="wordmark text-2xl">
          InvoiceFlow
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/pricing" className="px-3 py-2 text-quiet hover:text-ink">
            {tNav("pricing")}
          </Link>
          <Link href="/login" className="px-3 py-2 text-quiet hover:text-ink">
            {tNav("signIn")}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/signup" className="btn">
            {tNav("startFree")}
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-end gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_0.85fr]">
          <div>
            <h1 className="display max-w-[12ch] text-5xl leading-none sm:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-[38ch] text-lg text-quiet">
              {t("hero.subtitle")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="btn">
                {t("hero.ctaPrimary")}
              </Link>
              <Link href="/pricing" className="btn btn-ghost">
                {t("hero.ctaSecondary")}
              </Link>
            </div>
            <p className="mt-3 text-sm text-quiet">
              {t("hero.freeNote", { limit: FREE_MONTHLY_LIMIT })}
            </p>
          </div>

          <article className="sheet" aria-label={t("sample.ariaLabel")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="display italic">{t("sample.invoiceLabel")}</p>
                <p className="display money text-3xl">INV-2026-0048</p>
              </div>
              <p className="stamp stamp-due">{t("sample.due")}</p>
            </div>
            <div className="mt-5 space-y-2 border-t border-paper pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <span>{t("sample.lineItem1")}</span>
                <span className="money">{formatCents(171_000, "egp")}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{t("sample.lineItem2")}</span>
                <span className="money">{formatCents(13_000, "egp")}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-paper pt-3 font-medium">
                <span>{t("sample.total")}</span>
                <span className="money">{formatCents(184_000, "egp")}</span>
              </div>
            </div>
          </article>
        </section>

        <section className="border-t border-line py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="display text-3xl">{t("stepsHeading")}</h2>
            <dl className="mt-8 grid max-w-2xl gap-y-6">
              {steps.map((step) => (
                <div key={step.n} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="display row-start-1 self-center text-2xl leading-none tabular-nums lining-nums">
                    {step.n}
                  </dt>
                  <dd className="col-start-2 row-start-1 self-center min-w-0 leading-none">
                    <strong>{step.title}</strong>
                  </dd>
                  <dd className="col-start-2 row-start-2 min-w-0 text-quiet">{step.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-line py-14">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:grid-cols-2">
            <div>
              <h2 className="display text-3xl">{t("plansTeaser.heading")}</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <article>
                <h3 className="font-medium">{t("plansTeaser.free.name")}</h3>
                <p className="display money text-4xl">{tPrice("monthly", { amount: "0" })}</p>
                <ul className="mt-3 space-y-1 text-quiet">
                  <li>{t("plansTeaser.free.feature1", { limit: FREE_MONTHLY_LIMIT })}</li>
                  <li>{t("plansTeaser.free.feature2")}</li>
                </ul>
              </article>
              <article>
                <h3 className="font-medium">{t("plansTeaser.pro.name")}</h3>
                <p className="display money text-4xl">{proPrice}</p>
                <ul className="mt-3 space-y-1 text-quiet">
                  <li>{t("plansTeaser.pro.feature1")}</li>
                  <li>{t("plansTeaser.pro.feature2")}</li>
                </ul>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 px-5 py-8 text-sm text-quiet">
        <span>{t("footer.copyright")}</span>
        <Link href="/pricing" className="hover:text-ink">
          {tNav("pricing")}
        </Link>
      </footer>
    </div>
  );
}
