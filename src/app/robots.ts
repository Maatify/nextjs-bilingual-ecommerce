import "@/server/boot";
import type { MetadataRoute } from "next";
import { getSite } from "@/lib/site";

/**
 * Private / per-visitor storefront paths are kept out of the crawl (both languages). Pages that must be
 * crawlable to see their `noindex` (ad landing pages /lp/…, /track-order) are NOT disallowed here.
 * Collection filter/sort URLs (?size=…&color=…&sort=… — see components/collection/filters.ts) are
 * disallowed too: they are client-side views of the same collection (canonical = the bare collection URL).
 * Product `?color=` links stay crawlable (they're the variant offer URLs in the Product JSON-LD).
 */
const PRIVATE = ["/checkout", "/cart", "/search", "/wishlist", "/review/", "/collections/*?"];
const DISALLOW = [...PRIVATE, ...PRIVATE.map((p) => `/ar${p}`), "/admin", "/api/"];

/**
 * AI search / answer engines are explicitly welcome (same rules as everyone else, no Crawl-delay) so the store
 * can be cited in ChatGPT / Claude / Perplexity / Google AI answers. GPTBot, ClaudeBot and Google-Extended are
 * training crawlers — remove them here if the owner wants to opt out of model training.
 */
const AI_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  const site = getSite();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_BOTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${site.url.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
