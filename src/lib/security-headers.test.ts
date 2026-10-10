import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

function headerMap(source: string, nodeEnv: string | undefined) {
  const rule = securityHeaders(nodeEnv).find((entry) => entry.source === source);
  return Object.fromEntries((rule?.headers ?? []).map((header) => [header.key, header.value]));
}

describe("security headers", () => {
  it("locks the browser down in production without eval", () => {
    const headers = headerMap("/:path*", "production");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=63072000");
  });

  it("skips HSTS and allows the dev bundler to eval", () => {
    const headers = headerMap("/:path*", "development");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).toContain("'unsafe-eval'");
  });

  it("keeps shared invoice pages out of caches and search indexes", () => {
    const headers = headerMap("/pay/:path*", "production");
    expect(headers["Cache-Control"]).toBe("private, no-store");
    expect(headers["X-Robots-Tag"]).toBe("noindex");
  });
});
