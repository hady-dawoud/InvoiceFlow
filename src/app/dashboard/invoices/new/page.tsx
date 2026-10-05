import { PRO_MONTHLY_PRICE_LABEL } from "@/lib/plans";
import Link from "next/link";
import { InvoiceEditor } from "@/components/invoice-editor";
import { listClientOptions } from "@/lib/data/clients";
import { countInvoicesThisMonth } from "@/lib/data/invoices";
import { addDaysIso, todayIso } from "@/lib/invoice";
import { FREE_MONTHLY_LIMIT, getQuotaState } from "@/lib/quota";
import { getSession } from "@/lib/session";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const session = await getSession();
  const [clientOptions, usedThisMonth] = await Promise.all([
    listClientOptions(session.user.id),
    countInvoicesThisMonth(session.user.id),
  ]);
  const quota = getQuotaState(session.user.isPro, usedThisMonth);
  const today = todayIso();

  if (clientOptions.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
        <p className="text-quiet">You need a client before you can invoice.</p>
        <Link
          href="/dashboard/clients"
          className="mt-3 inline-block btn"
        >
          Add a client
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">New invoice</h1>
        {!quota.isPro && (
          <p className="mt-1 text-sm text-quiet">
            Free plan: {quota.used} of {quota.limit} invoices used this month.
          </p>
        )}
      </div>
      {quota.blocked ? (
        <div className="mx-auto max-w-md bg-sheet p-6 text-center shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
          <h2 className="display text-2xl">Free plan limit reached</h2>
          <p className="mt-2 text-sm text-quiet">
            You&apos;ve used all {FREE_MONTHLY_LIMIT} free invoices this month. Upgrade to Pro for
            unlimited invoices.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block btn"
          >
            Upgrade to Pro — {PRO_MONTHLY_PRICE_LABEL}/mo
          </Link>
        </div>
      ) : (
        <InvoiceEditor
          clients={clientOptions}
          currency={session.user.currency}
          initial={{
            clientId: clientOptions[0]!.id,
            issueDate: today,
            dueDate: addDaysIso(today, 14),
            taxBps: 0,
            notes: "",
            status: "draft",
            items: [],
          }}
        />
      )}
    </div>
  );
}
