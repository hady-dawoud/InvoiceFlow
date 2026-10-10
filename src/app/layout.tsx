import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, Outfit } from "next/font/google";
import { siteOrigin } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
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
      <body className={`${outfit.variable} ${fraunces.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
