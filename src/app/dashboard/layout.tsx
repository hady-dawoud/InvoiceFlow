import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavLinks } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const { user } = session;
  const t = await getTranslations("dashboard.plan");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
          <Link href="/dashboard" className="wordmark text-2xl">
            InvoiceFlow
          </Link>
          <NavLinks />
          <div className="ms-auto flex items-center gap-3">
            <span className="text-sm text-quiet">{user.isPro ? t("pro") : t("free")}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
