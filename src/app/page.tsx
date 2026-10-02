import Link from "next/link";
import { FREE_MONTHLY_LIMIT } from "@/lib/quota";

const FEATURES = [
  {
    title: "Invoices in 60 seconds",
    body: "Pick a client, add line items, hit send. No setup wizard, no learning curve.",
    icon: "⚡",
  },
  {
    title: "Know who owes you",
    body: "Every invoice is tracked — sent, paid, overdue. Your dashboard does the remembering.",
    icon: "📊",
  },
  {
    title: "Shareable client links",
    body: "Every invoice gets a clean public link your client can open and print. No attachments.",
    icon: "🔗",
  },
  {
    title: "PDF that looks professional",
    body: "Download a clean, branded PDF for your records or for clients who want an attachment.",
    icon: "📄",
  },
];

const STEPS = [
  { n: "1", title: "Add your client", body: "Name and billing email — that's all we need." },
  { n: "2", title: "Create the invoice", body: "Line items, tax if you charge it, due date. Live total as you type." },
  { n: "3", title: "Send & get paid", body: "Share the link, mark it paid when the money lands. Done." },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Invoice<span className="text-emerald-600">Flow</span>
        </span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/pricing" className="text-slate-500 hover:text-slate-900">
            Pricing
          </Link>
          <Link href="/login" className="text-slate-500 hover:text-slate-900">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            Start free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Professional invoices in{" "}
          <span className="text-emerald-600">60 seconds</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
          InvoiceFlow is the invoicing tool for freelancers who&apos;d rather do
          the work than invoice for it. Create, send and track — nothing else
          in your way.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Create your first invoice — free
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          No credit card required · {FREE_MONTHLY_LIMIT} free invoices every month
        </p>

        {/* Mock invoice preview */}
        <div className="mx-auto mt-14 max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Invoice
              </p>
              <p className="text-lg font-bold text-slate-900">INV-2026-0042</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Paid
            </span>
          </div>
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Landing page design</span>
              <span className="font-medium text-slate-900">$1,200.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Responsive implementation</span>
              <span className="font-medium text-slate-900">$3,600.00</span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-4">
            <span className="text-sm font-semibold text-slate-900">Total due</span>
            <span className="text-sm font-bold text-slate-900">$4,800.00</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <p className="text-2xl">{feature.icon}</p>
                <h3 className="mt-3 font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Three steps. That&apos;s the whole product.
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {step.n}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-16 text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Your next invoice is 60 seconds away
        </h2>
        <Link
          href="/signup"
          className="mt-6 inline-block rounded-lg bg-emerald-500 px-8 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          Start for free
        </Link>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        © 2026 InvoiceFlow ·{" "}
        <Link href="/pricing" className="hover:underline">
          Pricing
        </Link>{" "}
        · Built for freelancers
      </footer>
    </div>
  );
}
