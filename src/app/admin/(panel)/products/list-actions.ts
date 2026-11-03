"use server";

import type { Product, ProductStatus } from "@/lib/types";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getT } from "@/lib/i18n/admin/server";
import { getProduct, saveProduct } from "@/server/store";

/* Products list: WordPress-style Quick Edit + Shopify-style Bulk edit. */

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES: ProductStatus[] = ["active", "draft", "archived"];
const MAX_PRICE = 10_000_000;
const tagClean = (t: unknown) => (typeof t === "string" ? t.trim().toLowerCase().slice(0, 60) : "");

export interface QuickEditInput {
  title: string;
  status: ProductStatus;
  price: number;
  compareAt?: number | null;
  category: string;
  tags: string[];
}

export async function quickEditProduct(id: string, input: QuickEditInput): Promise<ActionResult<Product>> {
  await guard();
  const { t } = await getT();
  try {
    if (typeof id !== "string" || !ID.test(id)) return { ok: false, error: t("catalog.actions.invalidProduct") };
    if (!input || typeof input !== "object") return { ok: false, error: t("catalog.actions.invalidInput") };
    const p = getProduct(id);
    if (!p) return { ok: false, error: t("catalog.actions.notFound") };
    const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
    if (!title) return { ok: false, error: t("catalog.actions.titleRequired") };
    if (!STATUSES.includes(input.status)) return { ok: false, error: t("catalog.actions.invalidStatus") };
    const price = Math.round(Number(input.price) * 100) / 100;
    if (!(price > 0) || price > MAX_PRICE) return { ok: false, error: t("catalog.actions.priceRequired") };
    const cmp = input.compareAt === null || input.compareAt === undefined || (input.compareAt as unknown) === "" ? undefined : Math.round(Number(input.compareAt) * 100) / 100;
    if (cmp !== undefined && (!Number.isFinite(cmp) || cmp > MAX_PRICE)) return { ok: false, error: t("catalog.actions.invalidCompare") };
    if (cmp !== undefined && cmp <= price) return { ok: false, error: t("catalog.actions.compareHigher") };
    if (!Array.isArray(input.tags) || input.tags.length > 200) return { ok: false, error: t("catalog.actions.invalidTags") };
    const tags = [...new Set(input.tags.map(tagClean).filter(Boolean))];
    const category = typeof input.category === "string" ? input.category.trim().slice(0, 100) : p.category;
    const next: Product = { ...p, title, status: input.status, price, compareAt: cmp, category: category || p.category, collections: tags };
    saveProduct(next);
    published("Quick-edited product", title);
    return { ok: true, data: getProduct(id) ?? next };
  } catch (e) {
    return fail(e);
  }
}

export interface BulkEditInput {
  status?: ProductStatus;
  addTags?: string[];
  removeTags?: string[];
  price?: { mode: "pct" | "fixed"; dir: "up" | "down"; value: number };
  compareAt?: { mode: "keep" | "set" | "clear" | "original"; value?: number };
}

export async function bulkEditProducts(ids: string[], ops: BulkEditInput): Promise<ActionResult<{ updated: number; skipped: number }>> {
  await guard();
  const { t } = await getT();
  try {
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some((id) => typeof id !== "string" || !ID.test(id))) return { ok: false, error: t("catalog.actions.invalidSelection") };
    if (!ops || typeof ops !== "object") return { ok: false, error: t("catalog.actions.nothing") };
    if (ops.status !== undefined && !STATUSES.includes(ops.status)) return { ok: false, error: t("catalog.actions.invalidStatus") };
    const add = Array.isArray(ops.addTags) ? ops.addTags.slice(0, 50).map(tagClean).filter(Boolean) : [];
    const remove = new Set(Array.isArray(ops.removeTags) ? ops.removeTags.slice(0, 50).map(tagClean).filter(Boolean) : []);
    const pr = ops.price && Number(ops.price.value) > 0 ? { mode: ops.price.mode === "fixed" ? "fixed" : "pct", dir: ops.price.dir === "up" ? 1 : -1, value: Math.min(ops.price.mode === "fixed" ? MAX_PRICE : 95, Number(ops.price.value)) } : null;
    const cmpMode = ops.compareAt?.mode ?? "keep";
    if (!["keep", "set", "clear", "original"].includes(cmpMode)) return { ok: false, error: t("catalog.actions.invalidCompareOption") };
    const cmpValue = Number(ops.compareAt?.value);
    if (cmpMode === "set" && !(cmpValue > 0 && cmpValue <= MAX_PRICE)) return { ok: false, error: t("catalog.actions.enterCompare") };
    if (ops.status === undefined && !add.length && !remove.size && !pr && cmpMode === "keep") return { ok: false, error: t("catalog.actions.chooseChange") };

    const adjust = (n: number) => {
      if (!pr) return n;
      const v = pr.mode === "pct" ? n * (1 + (pr.dir * pr.value) / 100) : n + pr.dir * pr.value;
      return Math.max(1, Math.round(v));
    };
    let updated = 0;
    let skipped = 0;
    for (const id of ids) {
      const p = getProduct(id);
      if (!p) {
        skipped++;
        continue;
      }
      const old = p.price;
      const next: Product = { ...p };
      if (ops.status) next.status = ops.status;
      if (add.length || remove.size) next.collections = [...new Set([...p.collections.filter((t) => !remove.has(t)), ...add])];
      if (pr) {
        next.price = adjust(p.price);
        if (p.variants?.length) next.variants = p.variants.map((v) => (v.price !== undefined ? { ...v, price: adjust(v.price) } : v));
      }
      if (cmpMode === "clear") next.compareAt = undefined;
      else if (cmpMode === "set") next.compareAt = cmpValue;
      else if (cmpMode === "original") next.compareAt = Math.max(old, p.compareAt ?? 0);
      // a compare-at that isn't above the price would show a fake "sale" — drop it
      if (next.compareAt !== undefined && next.compareAt <= next.price) next.compareAt = undefined;
      saveProduct(next);
      updated++;
    }
    const what = [ops.status ? `status → ${ops.status}` : "", add.length ? `+${add.join(", ")}` : "", remove.size ? `−${[...remove].join(", ")}` : "", pr ? `price ${pr.dir > 0 ? "+" : "−"}${pr.value}${pr.mode === "pct" ? "%" : " EGP"}` : "", cmpMode !== "keep" ? `compare-at ${cmpMode}` : ""].filter(Boolean).join(" · ");
    published(`Bulk-edited ${updated} product${updated === 1 ? "" : "s"}`, undefined, what);
    return { ok: true, data: { updated, skipped } };
  } catch (e) {
    return fail(e);
  }
}
