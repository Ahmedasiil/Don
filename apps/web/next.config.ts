import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces a self-contained server in .next/standalone for any Node host or Docker.
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Links from the earlier preview.
  async redirects() {
    return [
      { source: "/pay", destination: "/app", permanent: false },
      { source: "/pay/:path*", destination: "/app/:path*", permanent: false },
      { source: "/admin/pay", destination: "/admin", permanent: false },
    ];
  },
  // The phone app's web preview (built from apps/mobile into public/mobile) is a single-page app.
  async rewrites() {
    return [
      { source: "/mobile", destination: "/mobile/index.html" },
      { source: "/mobile/:path((?!_expo/|assets/).*)", destination: "/mobile/index.html" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(self), usb=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://js.stripe.com https://challenges.cloudflare.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://challenges.cloudflare.com https:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.stripe.com",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
