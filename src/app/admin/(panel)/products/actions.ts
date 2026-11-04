"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import type { TFn } from "@/lib/i18n/admin";
import { getT } from "@/lib/i18n/admin/server";
import { sanitizeRichText } from "@/lib/rich-text";
import { normalizeVariants } from "@/lib/variants";
import {
  deleteProduct as dbDelete,
  getProduct,
  listCollections,
  listProducts,
  saveCollection,
  newProductId as dbNewId,
  reorderProducts as dbReorder,
  saveProduct as dbSave,
} from "@/server/store";
import type { Product, ProductAr, ProductStatus, ProductVariant } from "@/lib/types";

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES: ProductStatus[] = ["active", "draft", "archived"];
const BADGES = ["Bestseller", "New", "Limited", "Online exclusive"];
const MAX_PRICE = 10_000_000;
/** Bulk-action id list: real array of sane ids, capped. */
const idList = (ids: unknown): string[] | null => (Array.isArray(ids) && ids.length <= 1000 && ids.every((id) => typeof id === "string" && ID.test(id)) ? ids : null);
const cap = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");

function validate(p: Product, t: TFn) {
  if (!p.id) throw new Error(t("products.server.missingId"));
  if (!ID.test(p.id)) throw new Error(t("products.server.invalidId"));
  if (p.status !== undefined && !STATUSES.includes(p.status)) throw new Error(t("products.server.invalidStatus"));
  if (p.badge !== undefined && !BADGES.includes(p.badge)) throw new Error(t("products.server.invalidBadge"));
  if (p.price > MAX_PRICE) throw new Error(t("products.server.priceHigh"));
  if (p.colors.length > 50 || p.sizes.length > 50) throw new Error(t("products.server.tooManyOptions"));
  if (p.colors.some((c) => !Array.isArray(c.images) || c.images.length > 30 || c.images.some((u) => typeof u !== "string" || u.length > 500))) throw new Error(t("products.server.invalidImages"));
  if (!p.title.trim()) throw new Error(t("products.server.titleRequired"));
  if (!HANDLE.test(p.handle)) throw new Error(t("products.server.handleFormat"));
  if (!(p.price > 0)) throw new Error(t("products.server.price"));
  if (p.compareAt !== undefined && p.compareAt <= p.price) throw new Error(t("products.server.compareAt"));
  if (!p.colors.length) throw new Error(t("products.server.colorsNone"));
  if (!p.sizes.length) throw new Error(t("products.server.sizesNone"));
  if (p.colors.some((c) => !c.name.trim())) throw new Error(t("products.server.colorName"));
  if (new Set(p.colors.map((c) => c.name.trim().toLowerCase())).size !== p.colors.length) throw new Error(t("products.server.colorUnique"));
  if (new Set(p.sizes.map((s) => s.label.trim().toUpperCase())).size !== p.sizes.length) throw new Error(t("products.server.sizeUnique"));
  if (p.sizes.some((s) => !s.label.trim())) throw new Error(t("products.server.sizeLabel"));
  if (p.variants && p.variants.length > 2500) throw new Error(t("products.server.tooManyVariants"));
  if (p.variants?.some((v) => v.compareAt !== undefined && v.compareAt <= (v.price ?? p.price))) throw new Error(t("products.server.variantCompareAt"));
}

function clean(p: Product): Product {
  const num = (n: unknown, min = 0) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(MAX_PRICE, Math.max(min, v)) : min;
  };
  return {
    ...p,
    title: p.title.trim().slice(0, 200),
    handle: p.handle.trim().slice(0, 100),
    tagline: cap(p.tagline, 300),
    description: cleanDescription(p.description),
    category: cap(p.category, 100),
    material: cap(p.material, 200),
    price: num(p.price),
    compareAt: p.compareAt ? num(p.compareAt) : undefined,
    cost: p.cost ? num(p.cost) : undefined,
    gsm: p.gsm ? num(p.gsm) : undefined,
    rating: Math.min(5, num(p.rating)),
    reviewCount: Math.round(num(p.reviewCount)),
    sold24h: Math.round(num(p.sold24h)),
    sizes: p.sizes.map((s) => ({ label: s.label.trim().slice(0, 20), stock: Math.round(num(s.stock)) })),
    colors: p.colors.map((c) => ({ ...c, name: c.name.trim().slice(0, 60), hex: cap(c.hex, 32) })),
    highlights: p.highlights.slice(0, 50).map((h) => h.trim().slice(0, 500)).filter(Boolean),
    care: p.care.slice(0, 50).map((h) => h.trim().slice(0, 500)).filter(Boolean),
    collections: [...new Set(p.collections.slice(0, 200).map((t) => t.trim().slice(0, 100)).filter(Boolean))],
    badge: p.badge || undefined,
    modelInfo: p.modelInfo?.trim().slice(0, 500) || undefined,
    seoTitle: p.seoTitle?.trim().slice(0, 200) || undefined,
    seoDescription: p.seoDescription?.trim().slice(0, 500) || undefined,
    sku: cap(p.sku, 100) || undefined,
    barcode: cap(p.barcode, 64) || undefined,
    weight: p.weight ? Math.round(Math.min(1_000_000, num(p.weight))) : undefined,
    trackQuantity: p.trackQuantity === false ? false : undefined,
    variants: Array.isArray(p.variants) ? p.variants.slice(0, 2500).map((v) => cleanVariant(v, num)) : undefined,
    ar: cleanAr(p.ar, p.colors),
  };
}

/**
 * Arabic overrides: same caps as the English fields, rich text through the sanitizer, empty → dropped,
 * colour names only for colours that exist on the product (keyed by the English name).
 */
function cleanAr(raw: unknown, colors: Product["colors"]): ProductAr | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid-ar");
  const a = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => cap(v, max) || undefined;
  const list = (v: unknown) => {
    if (!Array.isArray(v)) return undefined;
    const out = v.slice(0, 50).map((x) => cap(x, 500)).filter(Boolean);
    return out.length ? out : undefined;
  };
  const names = new Set(colors.map((c) => (typeof c?.name === "string" ? c.name.trim().slice(0, 60) : "")).filter(Boolean));
  let colorNames: Record<string, string> | undefined;
  if (a.colors && typeof a.colors === "object" && !Array.isArray(a.colors)) {
    for (const [k, v] of Object.entries(a.colors as Record<string, unknown>).slice(0, 100)) {
      const name = cap(k, 60);
      const value = cap(v, 60);
      if (names.has(name) && value) (colorNames ??= {})[name] = value;
    }
  }
  const description = cleanDescription(a.description);
  const out: ProductAr = {
    title: str(a.title, 200),
    tagline: str(a.tagline, 300),
    description: description.replace(/<[^>]*>/g, "").trim() ? description : undefined,
    highlights: list(a.highlights),
    material: str(a.material, 200),
    care: list(a.care),
    modelInfo: str(a.modelInfo, 500),
    category: str(a.category, 100),
    seoTitle: str(a.seoTitle, 200),
    seoDescription: str(a.seoDescription, 500),
    colors: colorNames,
  };
  for (const k of Object.keys(out) as (keyof ProductAr)[]) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length ? out : undefined;
}

function cleanVariant(v: ProductVariant, num: (n: unknown, min?: number) => number): ProductVariant {
  const opt = (n: unknown) => (n === undefined || n === null || n === "" || !(Number(n) > 0) ? undefined : Math.round(num(n)));
  return {
    id: cap(v?.id, 64).replace(/[^A-Za-z0-9_-]/g, "") || "",
    color: cap(v?.color, 60),
    size: cap(v?.size, 20),
    stock: Math.round(Math.min(1_000_000, num(v?.stock))),
    price: opt(v?.price),
    compareAt: opt(v?.compareAt),
    sku: cap(v?.sku, 100) || undefined,
    barcode: cap(v?.barcode, 64) || undefined,
  };
}

/** Description: rich text through the strict allowlist sanitizer (plain text stays plain, escaped on render). */
function cleanDescription(d: unknown) {
  const raw = cap(d, 40000);
  return /<[a-z/!]/i.test(raw) ? sanitizeRichText(raw, 20000) : raw.slice(0, 20000);
}

const HANDLE_LIST = (v: unknown): string[] | null => (Array.isArray(v) && v.length <= 500 && v.every((h) => typeof h === "string" && HANDLE.test(h)) ? v : null);

/** Shopify-style collection checkboxes for manual collections: add/remove this product id. */
function applyManualCollections(productId: string, handles: string[]) {
  const want = new Set(handles);
  for (const c of listCollections()) {
    if (c.rule.type !== "manual") continue;
    const has = c.rule.productIds.includes(productId);
    if (want.has(c.handle) === has) continue;
    saveCollection({ ...c, rule: { type: "manual", productIds: has ? c.rule.productIds.filter((id) => id !== productId) : [...c.rule.productIds, productId] } });
  }
}

/** Create or update. With `create`, a fresh id is assigned if the proposed one was taken meanwhile. */
export async function saveProduct(input: Product, opts: { create?: boolean; manualCollections?: string[] } = {}): Promise<ActionResult<Product>> {
  await guard();
  const { t } = await getT();
  try {
    if (!input || typeof input !== "object" || !Array.isArray(input.colors) || !Array.isArray(input.sizes)) return { ok: false, error: t("products.server.invalidProduct") };
    const manual = opts.manualCollections === undefined ? null : HANDLE_LIST(opts.manualCollections);
    if (opts.manualCollections !== undefined && !manual) return { ok: false, error: t("products.server.invalidCollections") };
    let cleaned: Product;
    try {
      cleaned = clean(input);
    } catch (e) {
      if (e instanceof Error && e.message === "invalid-ar") return { ok: false, error: t("products.server.invalidArabic") };
      throw e;
    }
    const p = normalizeVariants(cleaned);
    if (opts.create && getProduct(p.id)) p.id = dbNewId();
    validate(p, t);
    const isNew = !getProduct(p.id);
    dbSave(p);
    if (manual) applyManualCollections(p.id, manual);
    published(isNew ? "Created product" : "Updated product", p.title);
    return { ok: true, data: getProduct(p.id) ?? p };
  } catch (e) {
    return fail(e);
  }
}
export async function deleteProduct(id: string): Promise<ActionResult> {
  await guard();
  try {
    const p = getProduct(id);
    dbDelete(id);
    published("Deleted product", p?.title ?? id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function duplicateProduct(id: string): Promise<ActionResult<string>> {
  await guard();
  const { t } = await getT();
  try {
    const src = getProduct(id);
    if (!src) throw new Error(t("products.server.notFound"));
    const handles = new Set(listProducts().map((p) => p.handle));
    let handle = `${src.handle}-copy`;
    for (let i = 2; handles.has(handle); i++) handle = `${src.handle}-copy-${i}`;
    const copy: Product = { ...structuredClone(src), id: dbNewId(), handle, title: `${src.title} (copy)`, ar: src.ar?.title ? { ...structuredClone(src.ar), title: `${src.ar.title} (نسخة)` } : structuredClone(src.ar), status: "draft", sold24h: 0 };
    dbSave(copy);
    published("Duplicated product", src.title, copy.id);
    return { ok: true, data: copy.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setProductsStatus(ids: string[], status: ProductStatus): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!STATUSES.includes(status)) return { ok: false, error: t("products.server.invalidStatus") };
    if (!idList(ids)) return { ok: false, error: t("products.server.invalidSelection") };
    for (const id of ids) {
      const p = getProduct(id);
      if (p && p.status !== status) dbSave({ ...p, status });
    }
    published(`Set ${ids.length} product${ids.length === 1 ? "" : "s"} to ${status}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProducts(ids: string[]): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!idList(ids)) return { ok: false, error: t("products.server.invalidSelection") };
    ids.forEach((id) => dbDelete(id));
    published(`Deleted ${ids.length} product${ids.length === 1 ? "" : "s"}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderProducts(ids: string[]): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!Array.isArray(ids) || ids.length > 5000) return { ok: false, error: t("products.server.invalidOrder") };
    const known = new Set(listProducts().map((p) => p.id));
    dbReorder(ids.filter((id) => known.has(id)));
    published("Reordered products");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
