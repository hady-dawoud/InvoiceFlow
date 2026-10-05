import Link from "next/link";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";
import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";

const STEPS = [
  { n: "1", title: "Add a client", body: "Name and billing email." },
  {
    n: "2",
    title: "Write the invoice",
    body: "Line items, tax if you charge it, and a due date. The total updates as you type.",
  },
  {
    n: "3",
    title: "Share the link",
    body: "Your client opens it and prints it. Mark it paid when the money arrives.",
  },
];

export default function LandingPage() {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
        <Link href="/" className="wordmark text-2xl">
          InvoiceFlow
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/pricing" className="px-3 py-2 text-quiet hover:text-ink">
            Pricing
          </Link>
          <Link href="/login" className="px-3 py-2 text-quiet hover:text-ink">
            Sign in
          </Link>
        </nav>
        <Link href="/signup" className="btn ml-auto">
          Start free
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-end gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_0.85fr]">
          <div>
            <h1 className="display max-w-[12ch] text-5xl leading-none sm:text-6xl">
              Send the invoice before lunch.
            </h1>
            <p className="mt-5 max-w-[38ch] text-lg text-quiet">
              Add a client, write the lines, share a link. InvoiceFlow is for
              freelancers who would rather do the work.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="btn">
                Create your first invoice
              </Link>
              <Link href="/pricing" className="btn btn-ghost">
                See pricing
              </Link>
            </div>
            <p className="mt-3 text-sm text-quiet">
              No card. {FREE_MONTHLY_LIMIT} invoices free each month.
            </p>
          </div>

          <article className="sheet" aria-label="Sample invoice">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="display italic">Invoice</p>
                <p className="display money text-3xl">INV-2026-0048</p>
              </div>
              <p className="stamp stamp-due">Due</p>
            </div>
            <div className="mt-5 space-y-2 border-t border-paper pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <span>Brand site, 18 hours</span>
                <span className="money">$1,710.00</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Photography direction</span>
                <span className="money">$130.00</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-paper pt-3 font-medium">
                <span>Total</span>
                <span className="money">$1,840.00</span>
              </div>
            </div>
          </article>
        </section>

        <section className="border-t border-line py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="display text-3xl">Three steps. Then you are back to work.</h2>
            <dl className="mt-8 grid max-w-2xl gap-x-8 gap-y-6 sm:grid-cols-[5rem_1fr]">
              {STEPS.map((step) => (
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
              <h2 className="display text-3xl">Free until you send more than three.</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <article>
                <h3 className="font-medium">Free</h3>
                <p className="display money text-4xl">$0</p>
                <ul className="mt-3 space-y-1 text-quiet">
                  <li>{FREE_MONTHLY_LIMIT} invoices each calendar month</li>
                  <li>Clients, links, and payment tracking</li>
                </ul>
              </article>
              <article>
                <h3 className="font-medium">Pro</h3>
                <p className="display money text-4xl">
                  {PRO_MONTHLY_PRICE_LABEL}
                  <span className="font-sans text-base font-normal"> / month</span>
                </p>
                <ul className="mt-3 space-y-1 text-quiet">
                  <li>Unlimited invoices</li>
                  <li>PDF download</li>
                </ul>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 px-5 py-8 text-sm text-quiet">
        <span>© 2026 InvoiceFlow</span>
        <Link href="/pricing" className="hover:text-ink">
          Pricing
        </Link>
      </footer>
    </div>
  );
}
