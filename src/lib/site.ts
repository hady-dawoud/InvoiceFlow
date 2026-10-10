export const PUBLIC_PATHS = ["/", "/pricing", "/login", "/signup"] as const;

export function siteOrigin() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  return configured || "http://localhost:3000";
}

export function robotsPolicy() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api/", "/pay/"],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}

export function sitemapEntries() {
  const origin = siteOrigin();
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? origin : `${origin}${path}`,
  }));
}
