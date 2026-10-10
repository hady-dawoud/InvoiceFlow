import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, Noto_Naskh_Arabic, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LatinDigitsForArabic } from "@/i18n/latin-digits-client";
import { siteOrigin } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-naskh-arabic",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.home");
  return {
    metadataBase: new URL(siteOrigin()),
    title: {
      default: t("metaTitle"),
      template: "%s · InvoiceFlow",
    },
    description: t("metaDescription"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body
        className={`${outfit.variable} ${fraunces.variable} ${notoNaskhArabic.variable} antialiased`}
      >
        <NextIntlClientProvider>
          <LatinDigitsForArabic />
          {children}
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
