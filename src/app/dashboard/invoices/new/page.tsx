import { formatWalletAmount, WALLET_PLANS } from "@/lib/wallet-billing";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InvoiceEditor } from "@/components/invoice-editor";
import { listClientOptions } from "@/lib/data/clients";
import { countInvoicesThisMonth } from "@/lib/data/invoices";
import { addDaysIso, todayIso } from "@/lib/invoice";
import { FREE_MONTHLY_LIMIT, getQuotaState } from "@/lib/quota";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invoice.new");
  return { title: t("metaTitle") };
}

export default async function NewInvoicePage() {
  const session = await getSession();
  const [t, tPrice] = await Promise.all([
    getTranslations("invoice.new"),
    getTranslations("price"),
  ]);
  const proPrice = tPrice("monthly", { amount: formatWalletAmount(WALLET_PLANS[0].amountEgp) });
  const [clientOptions, usedThisMonth] = await Promise.all([
    listClientOptions(session.user.id),
    countInvoicesThisMonth(session.user.id),
  ]);
  const quota = getQuotaState(session.user.isPro, usedThisMonth);
  const today = todayIso();

  if (clientOptions.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
        <p className="text-quiet">{t("needsClient")}</p>
        <Link
          href="/dashboard/clients"
          className="mt-3 inline-block btn"
        >
          {t("addClient")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">{t("heading")}</h1>
        {!quota.isPro && (
          <p className="mt-1 text-sm text-quiet">
            {t("quotaNotice.label")}: {t("quotaNotice.usage", { used: quota.used })}
          </p>
        )}
      </div>
      {quota.blocked ? (
        <div className="mx-auto max-w-md bg-sheet p-6 text-center shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
          <h2 className="display text-2xl">{t("quotaBlocked.heading")}</h2>
          <p className="mt-2 text-sm text-quiet">
            {t("quotaBlocked.usedAll", { limit: FREE_MONTHLY_LIMIT })}{" "}
            {t("quotaBlocked.upgradeNote")}
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block btn"
          >
            {t("quotaBlocked.upgradeCta", { price: proPrice })}
          </Link>
        </div>
      ) : (
        <InvoiceEditor
          clients={clientOptions}
          currency={session.user.currency}
          proPriceLabel={proPrice}
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
