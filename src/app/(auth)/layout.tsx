import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Link href="/" className="wordmark text-3xl">
          InvoiceFlow
        </Link>
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        {children}
      </div>
    </div>
  );
}
