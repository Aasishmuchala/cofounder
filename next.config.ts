import type { NextConfig } from "next";
import path from "path";

/**
 * Conservative, render-safe security headers applied to every response.
 *
 * The CSP intentionally omits `script-src`/`style-src`: Next, Tailwind v4, and
 * Framer Motion emit inline bootstrap scripts and inline styles, so a strict
 * script/style policy would require per-request nonces (forcing dynamic
 * rendering) and risk breaking hydration. Instead we lock down the directives
 * that are always safe — framing, base-tag, plugins, and form targets. The only
 * place attacker-controlled HTML is rendered (the artifact preview) is
 * separately neutralized by a script-less `<iframe sandbox>`.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (multiple lockfiles exist on the machine).
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
