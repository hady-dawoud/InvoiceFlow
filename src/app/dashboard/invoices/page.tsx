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
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={f === "all" ? "/dashboard/invoices" : `/dashboard/invoices?status=${f}`}
              className={`min-h-11 px-3 text-sm font-medium capitalize ${
                filter === f ? "bg-ink/8 text-ink" : "text-quiet hover:text-ink"
              }`}
            >
              {f}
            </Link>
          ))}
        </div>
        {quota.blocked ? (
          <Link
            href="/pricing"
            className="btn"
          >
            Free limit reached — upgrade for unlimited
          </Link>
        ) : (
          <Link
            href="/dashboard/invoices/new"
            className="btn"
          >
            New invoice
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center text-quiet">
          No {filter === "all" ? "" : filter} invoices.
        </div>
      ) : (
        <table className="ledger text-sm">
          <thead>
            <tr>
              <th>Number</th>
              <th>Client</th>
              <th>Issued</th>
              <th>Due</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id}>
                <td className="font-medium">
                  <Link href={`/dashboard/invoices/${inv.id}`} className="hover:underline">
                    {inv.number}
                  </Link>
                </td>
                <td>{inv.clientName}</td>
                <td>{inv.issueDate}</td>
                <td>{inv.dueDate}</td>
                <td>
                  <StatusBadge status={inv.status} dueDate={inv.dueDate} />
                </td>
                <td className="num money">{formatCents(inv.totalCents, session.user.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
