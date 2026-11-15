import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
  redirects: async () => [
    { source: "/inkomsten", destination: "/posten", permanent: false },
    { source: "/vaste-lasten", destination: "/posten", permanent: false },
    { source: "/uitjes", destination: "/uitgaven/uitjes", permanent: false },
    { source: "/tegenrekeningen", destination: "/uitgaven/tegenrekeningen", permanent: false },
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
