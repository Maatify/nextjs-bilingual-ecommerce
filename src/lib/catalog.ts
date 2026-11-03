import { snapshot } from "./data";
import type { Collection, Product } from "./types";

/*
 * Catalog accessors over the live store snapshot (SQLite on the server,
 * hydrated on the client). Products returned here are storefront-visible
 * ("active") only. Call inside render/functions — never at module scope.
 */

export { IMG } from "./seed/catalog";
export { colorStock, findVariant, isTracked, priceRange, variantPrice, variantStock, withColorStock, UNTRACKED_STOCK } from "./variants";

export const getProducts = (): Product[] => snapshot().products;
export const getCollections = (): Collection[] => snapshot().collections;
/** Collections shown in nav, chips and sitemaps */
export const getVisibleCollections = () => getCollections().filter((c) => !c.hidden);

export const getProduct = (handle: string) => getProducts().find((p) => p.handle === handle);
export const getProductById = (id: string) => getProducts().find((p) => p.id === id);
export const getCollection = (handle: string) => getCollections().find((c) => c.handle === handle);

export function inCollection(c: Collection, p: Product) {
  switch (c.rule.type) {
    case "all":
      return true;
    case "sale":
      return !!p.compareAt && p.compareAt > p.price;
    case "tag":
      return p.collections.includes(c.rule.tag);
    case "manual":
      return c.rule.productIds.includes(p.id);
  }
}

export const productsIn = (handle: string) => {
  const c = getCollection(handle);
  if (!c) return [];
  // a parent category also lists its child categories' products (WooCommerce behaviour)
  const children = getCollections().filter((x) => x.parent === c.handle);
  const list = getProducts().filter((p) => inCollection(c, p) || children.some((ch) => inCollection(ch, p)));
  // manual collections keep the merchant's order
  return c.rule.type === "manual" ? [...list].sort((a, b) => (c.rule as { productIds: string[] }).productIds.indexOf(a.id) - (c.rule as { productIds: string[] }).productIds.indexOf(b.id)) : list;
};

/** Category collections (Hoodies, Tees…): visible, rule-based, and every product shares one category. Used for round tiles. */
export function getCategoryCollections() {
  return getVisibleCollections().filter((c) => {
    if (c.rule.type === "all" || c.rule.type === "sale") return false;
    const items = productsIn(c.handle);
    return items.length > 0 && new Set(items.map((p) => p.category)).size === 1;
  });
}

export const totalStock = (p: Product) => p.sizes.reduce((n, s) => n + s.stock, 0);

/** Related products: same category first, then same gender, excluding self. */
export function related(p: Product, limit = 8) {
  const score = (q: Product) =>
    (q.category === p.category ? 3 : 0) + (q.gender === p.gender || q.gender === "unisex" ? 1 : 0) + q.rating;
  return getProducts()
    .filter((q) => q.id !== p.id)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

/** "Complete the look" — pieces from other categories that pair well. */
export function completeTheLook(p: Product, limit = 3) {
  const pairs: Record<string, string[]> = {
    Hoodies: ["Sweatpants", "T-Shirts", "Shorts"],
    Sweatshirts: ["Sweatpants", "T-Shirts", "Shorts"],
    "T-Shirts": ["Shorts", "Sweatpants", "Hoodies"],
    Sweatpants: ["Hoodies", "T-Shirts", "Sweatshirts"],
    Shorts: ["T-Shirts", "Hoodies", "Sweatshirts"],
  };
  const wanted = pairs[p.category] ?? [];
  const out: Product[] = [];
  for (const cat of wanted) {
    const hit = getProducts().find((q) => q.category === cat && q.id !== p.id && !out.includes(q));
    if (hit) out.push(hit);
  }
  return out.slice(0, limit);
}

/** Low-price add-on used in the cart and as the checkout order bump (admin → Settings → Checkout). */
export const getUpsellId = () => snapshot().settings.checkout.orderBumpProductId;
