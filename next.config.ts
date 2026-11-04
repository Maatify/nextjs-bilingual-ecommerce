import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// upgrade-insecure-requests is off when ADMIN_INSECURE_COOKIE marks a plain-http build (testing a production build on
// http://localhost) — headers() is resolved at build time. HSTS is always sent in production: browsers ignore it on
// plain http (RFC 6797 §8.1), so it can't break local testing, and a build accidentally made with the flag still
// pins the real domain to https.
const httpsOnly = isProd && !process.env.ADMIN_INSECURE_COOKIE;

/*
 * Content-Security-Policy — static header (no per-request nonce).
 *
 * script-src keeps 'unsafe-inline' on purpose: Next.js streams inline <script> tags (RSC payload,
 * bootstrap) into every page. The only way to drop 'unsafe-inline' is a per-request nonce, and reading
 * a nonce forces EVERY page to render dynamically (no static/ISR storefront, no CDN caching) — a big
 * performance cost for a paid-social storefront. We still get strong protection from the other
 * directives: scripts only from our own origin (no third-party hosts), no plugins (object-src 'none'),
 * no <base> hijacking, forms can only post to us or WhatsApp, and the site can't be framed.
 * 'unsafe-eval' is added in development only (React uses eval for dev error overlays / stack traces).
 */
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://wa.me",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/**": ["./deploy/vedra.db"] }, // DB snapshot for Vercel (see store.ts restoreSnapshot)
  poweredByHeader: false,
  // storefront root layout is app/[lang] and the admin has its own → 404s for unmatched URLs use app/global-not-found.tsx
  experimental: {
    globalNotFound: true,
    // Inlining the CSS as <style> (true) showed no Lighthouse gain in the 2026-11-03 runs (home mobile 98–99 either way;
    // the storefront stylesheet is already split from the admin's, see app/store.css), while it adds ~20 KB gz to every
    // HTML response and stops the browser caching the CSS between pages. Kept off.
    inlineCss: false,
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    qualities: [60, 70, 80],
    // Local shots only exist at 480w and 960w (see image-loader.ts), so the default 18-width srcset just
    // repeated the same two files in every <img>/preload tag. A shorter list keeps the HTML lighter;
    // Unsplash/imgix images still get sensible steps up to 1920w.
    deviceSizes: [640, 828, 1080, 1440, 1920],
    imageSizes: [48, 96, 256, 384],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // admin is never cached or indexed (src/proxy.ts sets the same on its responses)
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // catalog photos: cache in the browser/CDN (30 days, then refresh in the background) so pages don't re-request
      // every image on each visit — and a brief server restart can't leave cards without photos.
      // Not `immutable`: files keep their names if a photo is re-exported, so they must eventually revalidate.
      { source: "/p/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=604800" }] },
    ];
  },
};

export default nextConfig;
