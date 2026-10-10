import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";

export default async function LandingPage() {
  const tNav = await getTranslations("marketing.nav");
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
        <Link href="/signup" className="btn ml-auto">
          {tNav("startFree")}
        </Link>
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
                <span className="money">$1,710.00</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{t("sample.lineItem2")}</span>
                <span className="money">$130.00</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-paper pt-3 font-medium">
                <span>{t("sample.total")}</span>
                <span className="money">$1,840.00</span>
              </div>
            </div>
          </article>
        </section>

        <section className="border-t border-line py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="display text-3xl">{t("stepsHeading")}</h2>
            <dl className="mt-8 grid max-w-2xl gap-x-8 gap-y-6 sm:grid-cols-[5rem_1fr]">
              {steps.map((step) => (
                <div key={step.n} className="contents">
                  <dt className="display text-2xl">{step.n}</dt>
                  <dd>
                    <strong className="block">{step.title}</strong>
                    <span className="text-quiet">{step.body}</span>
                  </dd>
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
                <p className="display money text-4xl">$0</p>
                <ul className="mt-3 space-y-1 text-quiet">
                  <li>{t("plansTeaser.free.feature1", { limit: FREE_MONTHLY_LIMIT })}</li>
                  <li>{t("plansTeaser.free.feature2")}</li>
                </ul>
              </article>
              <article>
                <h3 className="font-medium">{t("plansTeaser.pro.name")}</h3>
                <p className="display money text-4xl">
                  {PRO_MONTHLY_PRICE_LABEL}
                  <span className="font-sans text-base font-normal">
                    {t("plansTeaser.pro.perMonth")}
                  </span>
                </p>
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
