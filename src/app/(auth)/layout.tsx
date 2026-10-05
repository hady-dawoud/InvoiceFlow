import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <Link href="/" className="wordmark mb-8 text-3xl">
        InvoiceFlow
      </Link>
      <div className="w-full max-w-sm bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        {children}
      </div>
    </div>
  );
}
