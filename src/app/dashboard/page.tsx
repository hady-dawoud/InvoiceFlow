import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { listInvoiceSummaries } from "@/lib/data/invoices";
import { listClientsWithStats } from "@/lib/data/clients";
import { isOverdue } from "@/lib/invoice";
import { formatCents } from "@/lib/money";
import { getQuotaState } from "@/lib/quota";
import { countInvoicesThisMonth } from "@/lib/data/invoices";
import { getSession } from "@/lib/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  const { user } = session;
  const currency = user.currency;

  const [summaries, usedThisMonth, clients] = await Promise.all([
    listInvoiceSummaries(user.id),
    countInvoicesThisMonth(user.id),
    listClientsWithStats(user.id),
  ]);
  const quota = getQuotaState(user.isPro, usedThisMonth);

  const billed = summaries
    .filter((inv) => inv.status !== "draft")
    .reduce((sum, inv) => sum + inv.totalCents, 0);
  const paid = summaries
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.totalCents, 0);
  const outstanding = summaries
    .filter((inv) => inv.status === "sent" && !isOverdue(inv))
    .reduce((sum, inv) => sum + inv.totalCents, 0);
  const overdue = summaries
    .filter((inv) => isOverdue(inv))
    .reduce((sum, inv) => sum + inv.totalCents, 0);

  const recent = summaries.slice(0, 5);

  const stats = [
    { label: "Billed (sent + paid)", value: formatCents(billed, currency) },
    { label: "Paid", value: formatCents(paid, currency) },
    { label: "Outstanding", value: formatCents(outstanding, currency) },
    { label: "Overdue", value: formatCents(overdue, currency), danger: overdue > 0 },
  ];

  return (
    <div className="space-y-8">
      {!quota.isPro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Free plan: <strong>{quota.used} of {quota.limit}</strong> invoices used this
            month.{" "}
            {quota.blocked
              ? "You've hit the limit — upgrade to keep invoicing."
              : `${quota.remaining} left before the wall.`}
          </p>
          <Link
            href="/pricing"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Upgrade to Pro — $9/mo
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
            <p
              className={`mt-1 text-2xl font-bold tracking-tight ${
                stat.danger ? "text-red-600" : "text-slate-900"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent invoices</h2>
          <Link href="/dashboard/invoices" className="text-sm font-medium text-emerald-600 hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            hasClients={clients.length > 0}
            quotaBlocked={quota.blocked}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Number</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <Link href={`/dashboard/invoices/${inv.id}`} className="hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{inv.clientName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{inv.dueDate}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={inv.status} dueDate={inv.dueDate} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                      {formatCents(inv.totalCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ hasClients, quotaBlocked }: { hasClients: boolean; quotaBlocked: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-slate-600">No invoices yet.</p>
      {quotaBlocked ? (
        <Link href="/pricing" className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Upgrade to create invoices
        </Link>
      ) : hasClients ? (
        <Link href="/dashboard/invoices/new" className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Create your first invoice
        </Link>
      ) : (
        <Link href="/dashboard/clients" className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Add a client first
        </Link>
      )}
    </div>
  );
}
