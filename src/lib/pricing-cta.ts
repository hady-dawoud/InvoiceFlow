export function pricingCallToAction(viewer: { isPro: boolean } | undefined): {
  href: "/signup" | "/dashboard/billing";
  label: "startFree" | "upgradeToPro" | "manageSubscription";
} {
  if (!viewer) return { href: "/signup", label: "startFree" };
  if (viewer.isPro) return { href: "/dashboard/billing", label: "manageSubscription" };
  return { href: "/dashboard/billing", label: "upgradeToPro" };
}
