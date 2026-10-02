import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "InvoiceFlow — Professional invoices in 60 seconds",
    template: "%s · InvoiceFlow",
  },
  description:
    "Create, send and track professional invoices in seconds. Built for freelancers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
