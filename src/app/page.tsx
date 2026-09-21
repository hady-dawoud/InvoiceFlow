import Link from "next/link";

// Placeholder landing — replaced by the full marketing page in Phase 6.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        Invoice<span className="text-emerald-600">Flow</span>
      </h1>
      <p className="max-w-md text-slate-600">
        Professional invoices in 60 seconds. Built for freelancers who&apos;d
        rather do the work than invoice for it.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Start for free
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
