import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { listInvoiceSummaries } from "@/lib/data/invoices";
import { listClientsWithStats } from "@/lib/data/clients";
import { invoiceOverview } from "@/lib/invoice-overview";
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

  const { billed, paid, outstanding, overdue } = invoiceOverview(summaries);

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
        <div className="notice flex flex-wrap items-center justify-between gap-3">
          <p>
            Free plan: <strong>{quota.used} of {quota.limit}</strong> invoices used this
            month.{" "}
            {quota.blocked
              ? "You've hit the limit — upgrade to keep invoicing."
              : `${quota.remaining} left before the wall.`}
          </p>
          <Link href="/pricing" className="btn">
            Upgrade to Pro — {PRO_MONTHLY_PRICE_LABEL}/mo
          </Link>
        </div>
      )}

      <section aria-labelledby="unpaid-label">
        <p id="unpaid-label" className="text-quiet">Unpaid</p>
        <p className="display money text-5xl sm:text-6xl">
          {formatCents(outstanding + overdue, currency)}
        </p>
        <p className="mt-2 text-quiet">
          {overdue > 0
            ? `${formatCents(overdue, currency)} is past its due date.`
            : "Nothing is past its due date."}
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
          {stats.filter((stat) => stat.label !== "Outstanding").map((stat) => (
            <div key={stat.label}>
              <dt className="text-quiet">{stat.label}</dt>
              <dd className={`money text-lg font-medium ${stat.danger ? "text-overdue" : ""}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent invoices</h2>
          <Link href="/dashboard/invoices" className="text-sm font-medium text-carbon hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            hasClients={clients.length > 0}
            quotaBlocked={quota.blocked}
          />
        ) : (
          <table className="ledger text-sm">
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Due</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-medium">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td>{inv.clientName}</td>
                  <td>{inv.dueDate}</td>
                  <td>
                    <StatusBadge status={inv.status} dueDate={inv.dueDate} />
                  </td>
                  <td className="num money">{formatCents(inv.totalCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function EmptyState({ hasClients, quotaBlocked }: { hasClients: boolean; quotaBlocked: boolean }) {
  return (
    <div className="bg-sheet px-6 py-12 text-center shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
      <p className="text-quiet">No invoices yet.</p>
      {quotaBlocked ? (
        <Link href="/pricing" className="btn mt-3">
          Upgrade to create invoices
        </Link>
      ) : hasClients ? (
        <Link href="/dashboard/invoices/new" className="btn mt-3">
          Create your first invoice
        </Link>
      ) : (
        <Link href="/dashboard/clients" className="btn mt-3">
          Add a client first
        </Link>
      )}
    </div>
  );
}
