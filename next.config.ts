import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships .afm font files that break inside the server bundle.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
