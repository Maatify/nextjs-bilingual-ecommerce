import type { Product } from "@/lib/types";

export const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "bestselling", label: "Bestselling" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low–high" },
  { value: "price-desc", label: "Price: high–low" },
  { value: "rating", label: "Top rated" },
] as const;
export type SortValue = (typeof SORTS)[number]["value"];

/** Bands fit the basics range (tees/shorts < 1,000 · bottoms & crews 1,000–1,500 · hoodies 1,500+). */
export const PRICE_BANDS = [
  { value: "0-1000", label: "Under EGP 1,000", min: 0, max: 999 },
  { value: "1000-1500", label: "EGP 1,000 – 1,500", min: 1000, max: 1499 },
  { value: "1500-", label: "EGP 1,500+", min: 1500, max: Infinity },
];

export interface FilterState {
  size: string[];
  color: string[];
  price: string[];
  cat: string[];
  sort: SortValue;
}

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

export function parseFilters(sp: { get(key: string): string | null }): FilterState {
  const sort = sp.get("sort");
  return {
    size: list(sp.get("size")),
    color: list(sp.get("color")),
    price: list(sp.get("price")),
    cat: list(sp.get("cat")),
    sort: (SORTS.some((s) => s.value === sort) ? sort : "featured") as SortValue,
  };
}

export function toQuery(f: FilterState, extra: Record<string, string | null> = {}) {
  const q = new URLSearchParams();
  if (f.size.length) q.set("size", f.size.join(","));
  if (f.color.length) q.set("color", f.color.join(","));
  if (f.price.length) q.set("price", f.price.join(","));
  if (f.cat.length) q.set("cat", f.cat.join(","));
  if (f.sort !== "featured") q.set("sort", f.sort);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return q.toString();
}

export const activeCount = (f: FilterState) => f.size.length + f.color.length + f.price.length + f.cat.length;

/** Apply every filter except `skip` — used to compute facet counts that stay meaningful while filtering. */
export function applyFilters(products: Product[], f: FilterState, skip?: keyof FilterState) {
  return products.filter((p) => {
    // size filter means "available in my size" — sold-out sizes don't count
    if (skip !== "size" && f.size.length && !p.sizes.some((s) => f.size.includes(s.label) && s.stock > 0)) return false;
    if (skip !== "color" && f.color.length && !p.colors.some((c) => f.color.includes(c.name))) return false;
    if (skip !== "cat" && f.cat.length && !f.cat.includes(p.category)) return false;
    if (skip !== "price" && f.price.length && !PRICE_BANDS.some((b) => f.price.includes(b.value) && p.price >= b.min && p.price <= b.max)) return false;
    return true;
  });
}

export function sortProducts(products: Product[], sort: SortValue) {
  const out = [...products];
  switch (sort) {
    case "bestselling":
      return out.sort((a, b) => b.sold24h - a.sold24h);
    case "newest":
      return out.sort((a, b) => Number(b.collections.includes("new")) - Number(a.collections.includes("new")) || b.id.localeCompare(a.id));
    case "price-asc":
      return out.sort((a, b) => a.price - b.price);
    case "price-desc":
      return out.sort((a, b) => b.price - a.price);
    case "rating":
      return out.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    default:
      return out;
  }
}

/** Facet options derived from the collection, in a sensible order. */
export function facets(products: Product[]) {
  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
  const sizes = [...new Set(products.flatMap((p) => p.sizes.map((s) => s.label)))].sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
  const colorMap = new Map<string, string>();
  products.forEach((p) => p.colors.forEach((c) => colorMap.has(c.name) || colorMap.set(c.name, c.hex)));
  const colors = [...colorMap].map(([name, hex]) => ({ name, hex }));
  const cats = [...new Set(products.map((p) => p.category))]; // catalog order: tops → bottoms
  return { sizes, colors, cats };
}
