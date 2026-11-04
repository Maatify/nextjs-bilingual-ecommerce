import { getContent, listCollections, listProducts } from "@/server/store";
import type { LinkTarget, ProductOption } from "@/components/admin/content/types";

export type { LinkTarget, ProductOption };

/* Read helpers for the Online store / Settings editors. */

/** Every internal destination a link picker can offer. */
export function linkTargets(): LinkTarget[] {
  const content = getContent();
  const store: LinkTarget[] = [
    { group: "Store", label: "Home", href: "/" },
    { group: "Store", label: "Search", href: "/search" },
    { group: "Store", label: "Wishlist", href: "/wishlist" },
    { group: "Store", label: "Cart", href: "/cart" },
    { group: "Store", label: "Track order", href: "/track-order" },
  ];
  const collections: LinkTarget[] = listCollections().map((c) => ({ group: "Collections", label: c.title, labelAr: c.ar?.title || undefined, href: `/collections/${c.handle}`, image: c.image || undefined }));
  const pages: LinkTarget[] = content.pages.map((p) => ({ group: "Pages", label: p.nav || [p.title, p.accent].filter(Boolean).join(" "), labelAr: p.ar?.nav || p.ar?.title || undefined, href: `/pages/${p.slug}` }));
  const products: LinkTarget[] = listProducts()
    .filter((p) => p.status !== "archived")
    .map((p) => ({ group: "Products", label: p.title, labelAr: p.ar?.title || undefined, href: `/products/${p.handle}`, image: p.colors[0]?.images[0] }));
  return [...store, ...collections, ...pages, ...products];
}

export function productOptions(): ProductOption[] {
  return listProducts()
    .filter((p) => p.status !== "archived")
    .map((p) => ({ id: p.id, title: p.title, image: p.colors[0]?.images[0] ?? "", price: p.price, status: p.status ?? "active" }));
}

