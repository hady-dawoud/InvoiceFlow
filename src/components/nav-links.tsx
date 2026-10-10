"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const LINKS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/dashboard/invoices", key: "invoices" },
  { href: "/dashboard/clients", key: "clients" },
  { href: "/dashboard/billing", key: "billing" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations("dashboard.nav");
  return (
    <nav className="flex flex-wrap gap-1" aria-label={t("ariaLabel")}>
      {LINKS.map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`min-h-11 px-3 text-sm font-medium ${
              active ? "bg-ink/8 text-ink" : "text-quiet hover:text-ink"
            }`}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
