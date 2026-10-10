import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // pdfkit ships .afm font files that break inside the server bundle.
  serverExternalPackages: ["pdfkit"],
  async headers() {
    return securityHeaders(process.env.NODE_ENV);
  },
};

export default nextConfig;
