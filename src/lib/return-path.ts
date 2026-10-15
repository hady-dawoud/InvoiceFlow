const DASHBOARD = "/dashboard";

/** Accept only a same-site dashboard path. `next` is taken from the query string. */
export function safeDashboardNext(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return DASHBOARD;
  }
  let url: URL;
  try {
    url = new URL(candidate, "http://localhost");
  } catch {
    return DASHBOARD;
  }
  if (url.origin !== "http://localhost") return DASHBOARD;
  if (url.pathname !== DASHBOARD && !url.pathname.startsWith(`${DASHBOARD}/`)) return DASHBOARD;
  return `${url.pathname}${url.search}`;
}
