import type { Product, ProductVariant, SizeStock } from "./types";

/*
 * Variant model (Shopify-style): every COLOUR × SIZE combination is a variant with
 * its own stock and optional price / compare-at / SKU / barcode overrides.
 *
 * `p.sizes[].stock` is kept as the derived total per size (sum over colours) so older
 * readers (filters, wishlist, admin lists) keep working. Pure functions only — safe to
 * import from the server store and from client components.
 */

/** Stock reported for products with "Track quantity" switched off. */
export const UNTRACKED_STOCK = 9999;

const key = (s: string) => s.trim().toLowerCase();
const slug = (s: string) =>
  key(s)
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "x";

export const isTracked = (p: Pick<Product, "trackQuantity">) => p.trackQuantity !== false;
export const hasVariants = (p: Pick<Product, "variants">) => !!p.variants?.length;

export function findVariant(p: Pick<Product, "variants">, color: string | undefined, size: string): ProductVariant | undefined {
  if (!p.variants?.length) return undefined;
  const s = key(size);
  if (color === undefined) return p.variants.find((v) => key(v.size) === s);
  const c = key(color);
  return p.variants.find((v) => key(v.color) === c && key(v.size) === s);
}

/** Units available for one colour × size (falls back to the per-size total for legacy products). */
export function variantStock(p: Product, color: string | undefined, size: string): number {
  if (!isTracked(p)) return UNTRACKED_STOCK;
  if (hasVariants(p)) {
    if (color === undefined) return p.variants!.filter((v) => key(v.size) === key(size)).reduce((n, v) => n + v.stock, 0);
    return findVariant(p, color, size)?.stock ?? 0;
  }
  return p.sizes.find((s) => s.label === size)?.stock ?? 0;
}

/** Total units of one colour across sizes. */
export const colorStock = (p: Product, color: string) => p.sizes.reduce((n, s) => n + variantStock(p, color, s.label), 0);

/** Price shown/charged for a variant (variant override → product price). compareAt only when higher than the price. */
export function variantPrice(p: Product, color?: string, size?: string): { price: number; compareAt?: number } {
  const v = size ? findVariant(p, color, size) : undefined;
  const price = v?.price ?? p.price;
  const compareAt = v?.compareAt ?? p.compareAt;
  return { price, compareAt: compareAt && compareAt > price ? compareAt : undefined };
}

/** Lowest / highest price across variants (equal when there are no overrides). */
export function priceRange(p: Product, color?: string): { min: number; max: number } {
  const vs = (p.variants ?? []).filter((v) => color === undefined || key(v.color) === key(color));
  const prices = vs.length ? vs.map((v) => v.price ?? p.price) : [p.price];
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * The product as seen with one colour selected: `sizes[].stock` becomes that colour's
 * stock per size. Lets size pickers stay simple (they only read `sizes`).
 */
export function withColorStock(p: Product, color: string): Product {
  if (!hasVariants(p) || !isTracked(p)) return p;
  return { ...p, sizes: p.sizes.map((s) => ({ ...s, stock: variantStock(p, color, s.label) })) };
}

/** Split `total` across `n` buckets: equal shares, remainder to the first buckets. */
export function splitStock(total: number, n: number): number[] {
  if (n <= 0) return [];
  const t = Math.max(0, Math.round(total));
  const base = Math.floor(t / n);
  return Array.from({ length: n }, (_, i) => base + (i < t % n ? 1 : 0));
}

/** Variants created from legacy per-size stock (each size's stock split across colours). */
export function variantsFromSizes(p: Pick<Product, "colors" | "sizes">): ProductVariant[] {
  const out: ProductVariant[] = [];
  const shares = p.sizes.map((s) => splitStock(s.stock, p.colors.length));
  p.colors.forEach((c, ci) => p.sizes.forEach((s, si) => out.push({ id: "", color: c.name, size: s.label, stock: shares[si][ci] ?? 0 })));
  return assignIds(out);
}

function assignIds(vs: ProductVariant[]): ProductVariant[] {
  const used = new Set<string>();
  return vs.map((v) => {
    let id = v.id && !used.has(v.id) ? v.id : `v-${slug(v.color)}-${slug(v.size)}`.slice(0, 60);
    for (let i = 2; used.has(id); i++) id = `v-${slug(v.color)}-${slug(v.size)}-${i}`.slice(0, 64);
    used.add(id);
    return { ...v, id };
  });
}

/**
 * Full colour × size grid in colour order, reusing existing variants (matched by name),
 * dropping orphans, and re-deriving `sizes[].stock`.
 */
export function normalizeVariants<T extends Product>(p: T): T {
  const existing = p.variants?.length ? p.variants : variantsFromSizes(p);
  const byKey = new Map(existing.map((v) => [`${key(v.color)}|${key(v.size)}`, v]));
  const grid: ProductVariant[] = [];
  for (const c of p.colors)
    for (const s of p.sizes) {
      const v = byKey.get(`${key(c.name)}|${key(s.label)}`);
      grid.push(v ? { ...v, color: c.name, size: s.label, stock: Math.max(0, Math.round(Number(v.stock) || 0)) } : { id: "", color: c.name, size: s.label, stock: 0 });
    }
  const variants = assignIds(grid);
  return { ...p, variants, sizes: deriveSizes({ ...p, variants }) };
}

/** Per-size totals from variants (or the untracked marker). */
export function deriveSizes(p: Pick<Product, "sizes" | "variants" | "trackQuantity">): SizeStock[] {
  return p.sizes.map((s) => ({
    label: s.label,
    stock: !isTracked(p) ? UNTRACKED_STOCK : (p.variants ?? []).filter((v) => key(v.size) === key(s.label)).reduce((n, v) => n + v.stock, 0),
  }));
}

/**
 * Apply a stock delta to a product. With a colour: that variant. Without (legacy callers):
 * spread over the size's variants — removals take from the best-stocked colours first,
 * additions go to the first colour. Never below zero. Returns a new, normalized product.
 */
export function adjustStock<T extends Product>(p: T, color: string | undefined, size: string, delta: number): T {
  if (!isTracked(p) || !delta) return p;
  const n = normalizeVariants(p);
  const vs = n.variants!.map((v) => ({ ...v }));
  const ofSize = vs.filter((v) => key(v.size) === key(size));
  const target = color !== undefined ? ofSize.filter((v) => key(v.color) === key(color)) : ofSize;
  if (!target.length) return n;
  if (delta > 0) target[0].stock += delta;
  else {
    let left = -delta;
    for (const v of [...target].sort((a, b) => b.stock - a.stock)) {
      const take = Math.min(left, v.stock);
      v.stock -= take;
      left -= take;
      if (!left) break;
    }
  }
  return { ...n, variants: vs, sizes: deriveSizes({ ...n, variants: vs }) };
}

/**
 * A legacy writer changed `sizes[].stock` without touching `variants` — fold each per-size
 * change into the variants so the totals stay authoritative for that write.
 */
export function reconcileSizeEdits<T extends Product>(next: T, prev: Product): T {
  if (!isTracked(next) || !isTracked(prev)) return next;
  let out = next;
  for (const s of next.sizes) {
    const before = prev.sizes.find((x) => x.label === s.label)?.stock;
    if (before === undefined || before === s.stock) continue;
    out = adjustStock(out, undefined, s.label, s.stock - variantStock(out, undefined, s.label));
  }
  return out;
}
