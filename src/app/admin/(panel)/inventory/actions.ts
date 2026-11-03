"use server";

import { normalizeVariants } from "@/lib/variants";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getT } from "@/lib/i18n/admin/server";
import { getProduct, saveProduct } from "@/server/store";

export interface VariantStockChange {
  productId: string;
  color: string;
  size: string;
  stock: number;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Save stock for many variants (colour × size) at once — one write per product. */
export async function saveVariantStock(changes: VariantStockChange[]): Promise<ActionResult<number>> {
  await guard();
  const { t } = await getT();
  try {
    if (!Array.isArray(changes) || changes.length > 20_000) return { ok: false, error: t("catalog.actions.invalidStock") };
    const byProduct = new Map<string, VariantStockChange[]>();
    for (const c of changes) {
      if (!c || typeof c !== "object" || typeof c.productId !== "string" || !ID.test(c.productId) || typeof c.color !== "string" || typeof c.size !== "string" || c.color.length > 60 || c.size.length > 20) return { ok: false, error: t("catalog.actions.invalidStock") };
      byProduct.set(c.productId, [...(byProduct.get(c.productId) ?? []), c]);
    }
    let cells = 0;
    const touched: string[] = [];
    for (const [id, list] of byProduct) {
      const p = getProduct(id);
      if (!p) continue;
      const n = normalizeVariants(p);
      let changed = false;
      for (const c of list) {
        const v = n.variants!.find((x) => x.color === c.color && x.size === c.size);
        if (!v) continue;
        const stock = Math.min(1_000_000, Math.max(0, Math.round(Number(c.stock) || 0)));
        if (stock === v.stock) continue;
        v.stock = stock;
        changed = true;
        cells++;
      }
      if (changed) {
        saveProduct(normalizeVariants(n));
        touched.push(p.title);
      }
    }
    if (cells) published("Updated stock", `${touched.length} product${touched.length === 1 ? "" : "s"}`, `${cells} variant${cells === 1 ? "" : "s"} changed`);
    return { ok: true, data: cells };
  } catch (e) {
    return fail(e);
  }
}
