import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {}, // Empty config to silence Turbopack warning with webpack-based next-pwa
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nolongerevil.com',
        pathname: '/_next/static/images/**',
      },
    ],
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig);
