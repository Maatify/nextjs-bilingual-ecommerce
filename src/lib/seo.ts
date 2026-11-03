import type { Metadata } from "next";
import { localeHref, type Locale } from "./i18n/store/config";
import { colorName, localizeContent, localizeProduct } from "./i18n/store/content";
import { richTextToPlain } from "./rich-text";
import { getOffer, getSite } from "./site";
import { socialLinks } from "./social";
import type { Product } from "./types";
import { getContent, snapshot } from "./data";

export const absolute = (path = "/") => new URL(path, getSite().url).toString();

/** Absolute URL of an internal path in a language ("/products/x" → "https://…/ar/products/x"). */
export const absoluteIn = (locale: Locale, path = "/") => absolute(localeHref(locale, path));

/**
 * canonical + hreflang alternates for a storefront path (given WITHOUT the locale prefix).
 * English is the x-default (unprefixed URLs).
 */
export function alternatesFor(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localeHref(locale, path),
    languages: { en: localeHref("en", path), ar: localeHref("ar", path), "x-default": localeHref("en", path) },
  };
}

/**
 * Fallback share image for pages that set their own `openGraph` (which drops the inherited one): the home
 * hero's lead photo (960×1200 product shot).
 */
export function brandOgImages(locale: Locale): NonNullable<NonNullable<Metadata["openGraph"]>["images"]> {
  const src = localizeContent(getContent(), locale).home.hero.images.find(Boolean);
  return src ? [{ url: src, width: 960, height: 1200, alt: getSite().name }] : [];
}

/** Store description in a language (Settings → Store details; Arabic falls back to English). */
export const siteDescription = (locale: Locale) => {
  const site = getSite();
  return locale === "ar" && site.descriptionAr?.trim() ? site.descriptionAr : site.description;
};

function returnPolicyLd() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "EG",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 14,
    returnMethod: "https://schema.org/ReturnByMail",
    // Mirrors /pages/returns: size exchanges are free, but a refund pickup costs EGP 50 (free only when faulty) —
    // so this must not claim FreeReturn. Keep in sync with the returns page if the fee changes.
    returnFees: "https://schema.org/ReturnShippingFees",
    returnShippingFeesAmount: { "@type": "MonetaryAmount", value: 50, currency: "EGP" },
  };
}

export function organizationLd(locale: Locale = "en") {
  const site = getSite();
  const sameAs = socialLinks(site).map((n) => n.href);
  const whatsapp = site.whatsapp?.replace(/\D/g, "");
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: site.name,
    legalName: site.legalName,
    url: absoluteIn(locale, "/"),
    description: siteDescription(locale),
    inLanguage: locale,
    logo: absolute("/icon.svg"),
    // Social profiles from Settings → Store details → Social media (same links as the footer and the side rail).
    // The demo data ships placeholder profile URLs; replace them in the admin before going live.
    ...(sameAs.length ? { sameAs } : {}),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        ...(site.phone ? { telephone: site.phone } : {}),
        ...(site.email ? { email: site.email } : {}),
        areaServed: "EG",
        availableLanguage: ["en", "ar"],
      },
      // WhatsApp is the main order/support channel (header/footer/product WhatsApp buttons use the same number)
      ...(whatsapp
        ? [{ "@type": "ContactPoint", contactType: "customer support", telephone: `+${whatsapp}`, url: `https://wa.me/${whatsapp}`, areaServed: "EG", availableLanguage: ["en", "ar"] }]
        : []),
    ],
    hasMerchantReturnPolicy: returnPolicyLd(),
  };
}

export function websiteLd(locale: Locale = "en") {
  const site = getSite();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: absoluteIn(locale, "/"),
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteIn(locale, "/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Reviews that may appear in structured data: published, for this product, and NOT demo/sample reviews
 * (`demo: true` previews must never become rating markup — Google treats it as fake review spam).
 */
function realReviews(p: Product) {
  return snapshot()
    .reviews.filter((r) => r.productId === p.id && r.status === "published" && !r.demo)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Variant stock / price / SKU for one colour × size (falls back to the size row and the product price). */
function variantOf(p: Product, color: string, size: string) {
  const v = p.variants?.find((x) => x.color === color && x.size === size);
  const stock = p.trackQuantity === false ? Infinity : (v?.stock ?? p.sizes.find((s) => s.label === size)?.stock ?? 0);
  return {
    stock,
    price: v?.price ?? p.price,
    compareAt: v?.compareAt ?? p.compareAt,
    sku: v?.sku || `${p.id}-${color}-${size}`.replace(/\s+/g, "").toUpperCase(),
    barcode: v?.barcode,
  };
}

export function productLd(base: Product, locale: Locale = "en") {
  const site = getSite();
  const OFFER = getOffer();
  const p = localizeProduct(base, locale);
  const url = absoluteIn(locale, `/products/${p.handle}`);
  const reviews = realReviews(base);
  const avg = reviews.length ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10 : 0;
  const img = (src: string) => absolute(src);
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    inLanguage: locale,
    name: p.title,
    description: richTextToPlain(p.description),
    url,
    image: p.colors.flatMap((c) => c.images.slice(0, 1)).map(img),
    productGroupID: p.sku || p.id,
    ...(p.barcode ? { gtin: p.barcode } : {}),
    brand: { "@type": "Brand", name: site.name },
    material: p.material,
    variesBy: ["https://schema.org/color", ...(p.sizes.length > 1 ? ["https://schema.org/size"] : [])],
    // only real, published, non-demo reviews — and no rating markup at all until there is one
    ...(reviews.length
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: avg, reviewCount: reviews.length, bestRating: 5, worstRating: 1 },
          review: reviews.slice(0, 3).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            datePublished: r.date,
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            ...(r.title ? { name: r.title } : {}),
            ...(r.body ? { reviewBody: r.body } : {}),
          })),
        }
      : {}),
    hasVariant: p.colors.flatMap((c) =>
      p.sizes.map((s) => {
        const v = variantOf(base, c.name, s.label);
        return {
          "@type": "Product",
          sku: v.sku,
          ...(v.barcode ? { gtin: v.barcode } : {}),
          name: `${p.title} — ${colorName(p, c.name, locale)}${p.sizes.length > 1 ? ` / ${s.label}` : ""}`,
          // one photo per variant (the colour's lead shot) — the full gallery is on the group; keeps the inline JSON-LD small
          image: c.images.slice(0, 1).map(img),
          color: colorName(p, c.name, locale),
          ...(p.sizes.length > 1 ? { size: s.label } : {}),
          offers: {
            "@type": "Offer",
            url: `${url}?color=${encodeURIComponent(c.name)}${p.sizes.length > 1 ? `&size=${encodeURIComponent(s.label)}` : ""}`,
            priceCurrency: "EGP",
            price: v.price,
            ...(v.compareAt && v.compareAt > v.price
              ? { priceSpecification: { "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice", price: v.compareAt, priceCurrency: "EGP" } }
              : {}),
            availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@type": "Organization", name: site.name },
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingDestination: { "@type": "DefinedRegion", addressCountry: "EG" },
              shippingRate: { "@type": "MonetaryAmount", value: v.price >= OFFER.freeShippingAt ? 0 : OFFER.shipping, currency: "EGP" },
              deliveryTime: {
                "@type": "ShippingDeliveryTime",
                handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
                transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
              },
            },
            hasMerchantReturnPolicy: returnPolicyLd(),
          },
        };
      }),
    ),
  };
}

/** paths are unprefixed storefront paths; they're localised here */
export function breadcrumbLd(items: { name: string; path: string }[], locale: Locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteIn(locale, it.path) })),
  };
}

export function itemListLd(products: Product[], locale: Locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteIn(locale, `/products/${p.handle}`), name: localizeProduct(p, locale).title })),
  };
}

export function faqLd(items: { q: string; a: string }[], locale: Locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
