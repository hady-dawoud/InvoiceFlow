import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { BUSINESS_CURRENCIES } from "@/lib/business-profile";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.settings");
  return { title: t("metaTitle") };
}

export default async function SettingsPage() {
  const session = await getSession();
  const t = await getTranslations("dashboard.settings");
  const { user } = session;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display text-3xl text-ink">{t("heading")}</h1>
      <p className="mt-2 text-quiet">{t("intro")}</p>
      <div className="mt-6 bg-sheet p-6 shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <BusinessProfileForm
          currencies={[...BUSINESS_CURRENCIES]}
          initial={{
            businessName: user.businessName ?? user.name,
            currency: user.currency,
            taxId: user.taxId ?? "",
            paymentInstructions: user.paymentInstructions ?? "",
          }}
        />
      </div>
    </div>
  );
}
