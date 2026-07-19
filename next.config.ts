import type { NextConfig } from "next";

/*
 * Content-Security-Policy. The app renders no user-supplied HTML and calls no
 * third-party origins from the browser (Upstash is server-side only), so the
 * policy can be tight. Notes:
 *  - 'unsafe-inline' in style-src: several components use inline style={{…}}.
 *  - 'unsafe-inline' in script-src: Next injects inline bootstrap scripts. A
 *    nonce-based policy is stricter but needs per-request middleware; not worth
 *    it here given there is no injection sink for an attacker to reach.
 *  - worker-src 'self' blob:: the simulation runs in a bundled Web Worker.
 *  - connect-src 'self': the only fetch target (/api/snapshot) is same-origin.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Playwright drives the dev server on 127.0.0.1; without this, Next 16 blocks
  // its own /_next dev resources as cross-origin and the Web Worker never boots.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // The CSP protects the deployed site. It is skipped in development so
          // it doesn't block the eval() and websockets React/Turbopack use for
          // hot reload and debug tooling — React never uses eval() in production.
          ...(isProd ? [{ key: "Content-Security-Policy", value: CSP }] : []),
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
