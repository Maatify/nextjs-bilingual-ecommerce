import { completeTheLook, getProductById, getProducts, getUpsellId, variantStock } from "@/lib/catalog";
import type { CartLine, Product } from "@/lib/types";

/** Cart cross-sells: the matching-set piece for what's in the bag first, then the tee, then anything else. */
export function pickUpsells(cart: CartLine[], limit = 3): Product[] {
  const inCart = new Set(cart.map((l) => l.productId));
  const anchor = cart.length ? getProductById(cart[cart.length - 1].productId) : undefined;
  const pool = [...(anchor ? completeTheLook(anchor, 3) : []), getProductById(getUpsellId()), ...getProducts()].filter((p): p is Product => !!p);
  const out: Product[] = [];
  for (const p of pool) {
    if (inCart.has(p.id) || out.includes(p) || p.sizes.every((s) => s.stock <= 0)) continue;
    out.push(p);
    if (out.length === limit) break;
  }
  return out;
}

/** Default quick-add variant: the first colour that has M in stock (most common), otherwise any colour × size with stock. */
export function defaultVariant(p: Product): { color: string; size: string } {
  const sizes = [...p.sizes].sort((a, b) => (b.label === "M" ? 1 : 0) - (a.label === "M" ? 1 : 0));
  for (const s of sizes) for (const c of p.colors) if (variantStock(p, c.name, s.label) > 0) return { color: c.name, size: s.label };
  return { color: p.colors[0].name, size: p.sizes[0].label };
}

/** Default quick-add size (see defaultVariant). */
export const defaultSize = (p: Product) => defaultVariant(p).size;
