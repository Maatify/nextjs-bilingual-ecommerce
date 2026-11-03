import "@/server/boot";
import type { MetadataRoute } from "next";
import { getProducts, getVisibleCollections, productsIn } from "@/lib/catalog";
import { getPages } from "@/lib/content";
import { LOCALES } from "@/lib/i18n/store/config";
import { absolute, absoluteIn } from "@/lib/seo";
import type { Product } from "@/lib/types";

type Entry = MetadataRoute.Sitemap[number];

/** Re-generated at most hourly (admin writes also revalidate it via revalidatePath("/", "layout")). */
export const revalidate = 3600;

/** Latest real edit among these products (undefined when none carry an updatedAt — better no lastmod than a fake one). */
const lastEdit = (products: Product[]) => {
  const t = Math.max(0, ...products.map((p) => (p.updatedAt ? Date.parse(p.updatedAt) || 0 : 0)));
  return t ? new Date(t) : undefined;
};

/**
 * Every indexable storefront URL in English (unprefixed) and Arabic (/ar/…), each listing its hreflang twins.
 * Not listed (noindex / private): cart, checkout, thank-you, search, wishlist, track-order, /lp ad pages, review links.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const products = getProducts();
  const both = (path: string, rest: Omit<Entry, "url" | "alternates">): Entry[] =>
    LOCALES.map((l) => ({
      url: absoluteIn(l, path),
      alternates: { languages: { en: absoluteIn("en", path), ar: absoluteIn("ar", path), "x-default": absoluteIn("en", path) } },
      ...rest,
    }));
  return [
    ...both("/", { lastModified: lastEdit(products), changeFrequency: "daily", priority: 1 }),
    ...getVisibleCollections().flatMap((c) =>
      both(`/collections/${c.handle}`, { lastModified: lastEdit(productsIn(c.handle)), changeFrequency: "daily", priority: c.handle === "all" ? 0.9 : 0.8 }),
    ),
    ...products.flatMap((p) =>
      both(`/products/${p.handle}`, {
        lastModified: lastEdit([p]),
        changeFrequency: "weekly",
        priority: 0.7,
        // image sitemap entries must be absolute URLs
        images: p.colors.flatMap((c) => c.images.slice(0, 2)).slice(0, 6).map((src) => absolute(src)),
      }),
    ),
    ...getPages().flatMap((p) => both(`/pages/${p.slug}`, { changeFrequency: "monthly", priority: 0.4 })),
  ];
}
