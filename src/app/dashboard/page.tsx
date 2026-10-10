import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/status-badge";
import { listInvoiceSummaries } from "@/lib/data/invoices";
import { listClientsWithStats } from "@/lib/data/clients";
import { invoiceOverview } from "@/lib/invoice-overview";
import { formatCents } from "@/lib/money";
import { getQuotaState } from "@/lib/quota";
import { countInvoicesThisMonth } from "@/lib/data/invoices";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("metaTitle") };
}

export default async function DashboardPage() {
  const session = await getSession();
  const { user } = session;
  const currency = user.currency;
  const t = await getTranslations("dashboard.home");

  const [summaries, usedThisMonth, clients] = await Promise.all([
    listInvoiceSummaries(user.id),
    countInvoicesThisMonth(user.id),
    listClientsWithStats(user.id),
  ]);
  const quota = getQuotaState(user.isPro, usedThisMonth);

  const { billed, paid, outstanding, overdue } = invoiceOverview(summaries);

  const recent = summaries.slice(0, 5);

  const stats: { key: "billed" | "paid" | "outstanding" | "overdue"; value: string; danger: boolean }[] = [
    { key: "billed", value: formatCents(billed, currency), danger: false },
    { key: "paid", value: formatCents(paid, currency), danger: false },
    { key: "outstanding", value: formatCents(outstanding, currency), danger: false },
    { key: "overdue", value: formatCents(overdue, currency), danger: overdue > 0 },
  ];

  return (
    <div className="space-y-8">
      {!quota.isPro && (
        <div className="notice flex flex-wrap items-center justify-between gap-3">
          <p>
            {t("quotaNotice.prefix")}{" "}
            <strong>{t("quotaNotice.usedOfLimit", { used: quota.used, limit: quota.limit ?? 0 })}</strong>{" "}
            {t("quotaNotice.suffix")}{" "}
            {quota.blocked
              ? t("quotaNotice.blocked")
              : t("quotaNotice.remaining", { remaining: quota.remaining })}
          </p>
          <Link href="/pricing" className="btn">
            {t("quotaNotice.upgrade", { price: PRO_MONTHLY_PRICE_LABEL })}
          </Link>
        </div>
      )}

      <section aria-labelledby="unpaid-label">
        <p id="unpaid-label" className="text-quiet">{t("unpaidLabel")}</p>
        <p className="display money text-5xl sm:text-6xl">
          {formatCents(outstanding + overdue, currency)}
        </p>
        <p className="mt-2 text-quiet">
          {overdue > 0
            ? t("overdueNote", { amount: formatCents(overdue, currency) })
            : t("noOverdue")}
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
          {stats.filter((stat) => stat.key !== "outstanding").map((stat) => (
            <div key={stat.key}>
              <dt className="text-quiet">{t(`stats.${stat.key}`)}</dt>
              <dd className={`money text-lg font-medium ${stat.danger ? "text-overdue" : ""}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">{t("recentInvoices")}</h2>
          <Link href="/dashboard/invoices" className="text-sm font-medium text-carbon hover:underline">
            {t("viewAll")}
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
                <th>{t("table.number")}</th>
                <th>{t("table.client")}</th>
                <th>{t("table.due")}</th>
                <th>{t("table.status")}</th>
                <th>{t("table.total")}</th>
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

async function EmptyState({ hasClients, quotaBlocked }: { hasClients: boolean; quotaBlocked: boolean }) {
  const t = await getTranslations("dashboard.home.empty");
  return (
    <div className="bg-sheet px-6 py-12 text-center shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
      <p className="text-quiet">{t("noInvoices")}</p>
      {quotaBlocked ? (
        <Link href="/pricing" className="btn mt-3">
          {t("upgradeToCreate")}
        </Link>
      ) : hasClients ? (
        <Link href="/dashboard/invoices/new" className="btn mt-3">
          {t("createFirst")}
        </Link>
      ) : (
        <Link href="/dashboard/clients" className="btn mt-3">
          {t("addClientFirst")}
        </Link>
      )}
    </div>
  );
}
