import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { countInvoicesThisMonth, listInvoiceSummaries } from "@/lib/data/invoices";
import { isOverdue } from "@/lib/invoice";
import { formatCents } from "@/lib/money";
import { getQuotaState } from "@/lib/quota";
import { getSession } from "@/lib/session";

export const metadata = { title: "Invoices" };

const FILTERS = ["all", "draft", "sent", "paid", "overdue"] as const;
type Filter = (typeof FILTERS)[number];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  const { status: rawStatus } = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as Filter)
    : "all";

  const [summaries, usedThisMonth] = await Promise.all([
    listInvoiceSummaries(session.user.id),
    countInvoicesThisMonth(session.user.id),
  ]);
  const quota = getQuotaState(session.user.isPro, usedThisMonth);

  const filtered = summaries.filter((inv) => {
    if (filter === "all") return true;
    if (filter === "overdue") return isOverdue(inv);
    return inv.status === filter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === "all" ? "/dashboard/invoices" : `/dashboard/invoices?status=${f}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                filter === f ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {f}
            </Link>
          ))}
        </div>
        {quota.blocked ? (
          <Link
            href="/pricing"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Free limit reached — upgrade for unlimited
          </Link>
        ) : (
          <Link
            href="/dashboard/invoices/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New invoice
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-600">
          No {filter === "all" ? "" : filter} invoices.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Issued</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{inv.clientName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{inv.issueDate}</td>
                  <td className="px-4 py-2.5 text-slate-600">{inv.dueDate}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={inv.status} dueDate={inv.dueDate} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                    {formatCents(inv.totalCents, session.user.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
