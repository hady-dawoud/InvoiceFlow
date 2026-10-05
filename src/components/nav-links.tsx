"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/billing", label: "Billing" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Account">
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
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
