import { allOrders, getContent, listCollections, listProducts } from "@/server/store";
import type { Product } from "@/lib/types";

/*
 * Read-side helpers for the admin catalog screens (products, inventory,
 * collections, media). Pure reads over src/server/store.ts.
 */

/** Units sold per product id, counting every order that wasn't cancelled or returned. */
export function unitsSoldByProduct(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of allOrders()) {
    if (o.status === "cancelled" || o.status === "returned" || o.status === "draft") continue;
    for (const l of o.lines) out[l.productId] = (out[l.productId] ?? 0) + l.qty;
  }
  return out;
}

export interface ProductRow {
  product: Product;
  sold: number;
  stock: number;
}

export function productRows(): ProductRow[] {
  const sold = unitsSoldByProduct();
  return listProducts().map((p) => ({ product: p, sold: sold[p.id] ?? 0, stock: (p.variants?.length ? p.variants.reduce((n, v) => n + v.stock, 0) : p.sizes.reduce((n, s) => n + s.stock, 0)) }));
}


export interface AssignableCollection {
  handle: string;
  title: string;
  /** "Parent › Child" when the collection has a parent */
  path: string;
  type: "tag" | "manual";
  tag?: string;
  productIds?: string[];
  hidden: boolean;
}

/** Options used by the product editor's sidebar. */
export function catalogOptions() {
  const products = listProducts();
  const collections = listCollections();
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const tagSet = new Set<string>();
  for (const c of collections) if (c.rule.type === "tag") tagSet.add(c.rule.tag);
  for (const p of products) p.collections.forEach((t) => tagSet.add(t));
  const tagTitles: Record<string, string> = {};
  for (const c of collections) if (c.rule.type === "tag") tagTitles[c.rule.tag] = c.title;
  const titles = new Map(collections.map((c) => [c.handle, c.title]));
  // "Categories" in the editor = tag- and manual-rule collections (Shopify's collection checkboxes)
  const assignable: AssignableCollection[] = collections
    .filter((c) => c.rule.type === "tag" || c.rule.type === "manual")
    .map((c) => ({
      handle: c.handle,
      title: c.title,
      path: c.parent && titles.get(c.parent) ? `${titles.get(c.parent)} › ${c.title}` : c.title,
      type: c.rule.type as "tag" | "manual",
      tag: c.rule.type === "tag" ? c.rule.tag : undefined,
      productIds: c.rule.type === "manual" ? c.rule.productIds : undefined,
      hidden: !!c.hidden,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    categories,
    tags: [...tagSet].sort(),
    tagTitles,
    handles: products.map((p) => ({ id: p.id, handle: p.handle })),
    collections: assignable,
  };
}

export interface MediaUse {
  label: string;
  href: string;
}

/** Where every image URL is referenced: product colours, collection covers, homepage hero. */
export function mediaUsage(labels: { collection: string; hero: string } = { collection: "Collection", hero: "Homepage hero" }): Record<string, MediaUse[]> {
  const out: Record<string, MediaUse[]> = {};
  const add = (url: string, use: MediaUse) => {
    if (!url) return;
    (out[url] ??= []).push(use);
  };
  for (const p of listProducts()) for (const c of p.colors) for (const u of c.images) add(u, { label: `${p.title} · ${c.name}`, href: `/admin/products/${p.id}` });
  for (const c of listCollections()) add(c.image, { label: `${labels.collection} · ${c.title}`, href: "/admin/collections" });
  try {
    for (const u of getContent().home.hero.images) add(u, { label: labels.hero, href: "/admin/homepage" });
  } catch {
    /* content shape changed — ignore */
  }
  return out;
}

export interface PickProduct {
  id: string;
  title: string;
  image: string;
  status: string;
  price: number;
  compareAt?: number;
  collections: string[];
  category: string;
}

/** Lightweight product list for collection rule previews and the manual picker. */
export function pickProducts(): PickProduct[] {
  return listProducts().map((p) => ({ id: p.id, title: p.title, image: p.colors[0]?.images[0] ?? "", status: p.status ?? "active", price: p.price, compareAt: p.compareAt, collections: p.collections, category: p.category }));
}
