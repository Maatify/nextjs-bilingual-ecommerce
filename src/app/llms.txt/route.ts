import "@/server/boot";
import { getProducts, getVisibleCollections } from "@/lib/catalog";
import { getPages } from "@/lib/content";
import { formatMoney } from "@/lib/i18n/store/config";
import { localizeCollection, localizePage, localizeProduct } from "@/lib/i18n/store/content";
import { absoluteIn, siteDescription } from "@/lib/seo";
import { getOffer, getSite } from "@/lib/site";

/*
 * /llms.txt — a short, plain-Markdown summary of the store for AI answer engines (https://llmstxt.org).
 * Built from the same live data as the sitemap (store settings, collections, products, CMS pages) and the
 * site URL from Settings → Store details — nothing is hardcoded here. Static, refreshed at most hourly
 * (admin writes also revalidate it through revalidatePath("/", "layout")).
 * The proxy matcher skips paths containing a dot, so this is never rewritten to /en/….
 */
export const dynamic = "force-static";
export const revalidate = 3600;

const POLICY_PAGES = ["shipping", "returns", "faq", "size-guide", "contact"];
const oneLine = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function GET() {
  const site = getSite();
  const offer = getOffer();
  const pages = getPages();
  const collections = getVisibleCollections();
  const products = getProducts();

  const offers = [
    offer.bogoEnabled ? `Buy ${offer.bogo.buy} Get ${offer.bogo.get} Free` : "",
    offer.multiBuy?.enabled ? `${offer.multiBuy.pct}% off ${offer.multiBuy.qty}+ pieces` : "",
    offer.freeShippingAt ? `free shipping over ${formatMoney(offer.freeShippingAt, "en")}` : "",
  ].filter(Boolean);

  const policy = POLICY_PAGES.map((slug) => pages.find((p) => p.slug === slug)).filter((p) => p !== undefined);

  const lines = [
    `# ${site.name}`,
    "",
    `> ${oneLine(siteDescription("en"))}`,
    "",
    `> ${oneLine(siteDescription("ar"))}`,
    "",
    `Online clothing store in Egypt. Prices in ${site.currency || "EGP"}. Payment: cash on delivery.${offers.length ? ` Offers: ${offers.join(", ")}.` : ""}`,
    "English pages are unprefixed; Arabic (RTL) versions live under /ar.",
    "",
    "## Policies",
    "",
    ...policy.map((p) => {
      const ar = localizePage(p, "ar");
      return `- [${oneLine(p.nav || p.title)}](${absoluteIn("en", `/pages/${p.slug}`)}): ${oneLine(p.description)} ([العربية](${absoluteIn("ar", `/pages/${p.slug}`)}): ${oneLine(ar.description)})`;
    }),
    "",
    "## Collections",
    "",
    ...collections.map((c) => {
      const ar = localizeCollection(c, "ar");
      return `- [${oneLine(c.title)}](${absoluteIn("en", `/collections/${c.handle}`)}) · [${oneLine(ar.title)}](${absoluteIn("ar", `/collections/${c.handle}`)})`;
    }),
    "",
    "## Products",
    "",
    ...products.map((p) => {
      const ar = localizeProduct(p, "ar");
      return `- [${oneLine(p.title)}](${absoluteIn("en", `/products/${p.handle}`)}): ${formatMoney(p.price, "en")}${p.tagline ? ` — ${oneLine(p.tagline)}` : ""} · [${oneLine(ar.title)}](${absoluteIn("ar", `/products/${p.handle}`)})`;
    }),
    "",
    "## Contact",
    "",
    ...[
      site.whatsapp ? `- WhatsApp: https://wa.me/${site.whatsapp.replace(/\D/g, "")}` : "",
      site.phone ? `- Phone: ${site.phone}` : "",
      site.email ? `- Email: ${site.email}` : "",
    ].filter(Boolean),
    "",
    "## Optional",
    "",
    ...pages
      .filter((p) => !POLICY_PAGES.includes(p.slug))
      .map((p) => `- [${oneLine(p.nav || p.title)}](${absoluteIn("en", `/pages/${p.slug}`)}): ${oneLine(p.description)}`),
    `- [Sitemap](${absoluteIn("en", "/sitemap.xml")})`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
