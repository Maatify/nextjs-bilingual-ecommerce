"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getT } from "@/lib/i18n/admin/server";
import { listCollections, listProducts, saveCollection, saveProduct } from "@/server/store";

/* Product tags = the values in Product.collections (they drive tag-based categories). */

const TAG = /^[\p{L}\p{N}][\p{L}\p{N} _&'-]{0,59}$/u;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
const clean = (t: unknown) => (typeof t === "string" ? t.trim().slice(0, 60) : "");
const tagList = (v: unknown): string[] | null => (Array.isArray(v) && v.length && v.length <= 200 && v.every((t) => typeof t === "string" && t.length <= 100) ? v : null);

/** Replace every tag in `from` with `to` (or drop them when `to` is null) on products and tag-rule categories. */
function retag(from: Set<string>, to: string | null) {
  let products = 0;
  for (const p of listProducts()) {
    if (!p.collections.some((t) => from.has(t))) continue;
    const next = [...new Set(p.collections.flatMap((t) => (from.has(t) ? (to ? [to] : []) : [t])))];
    saveProduct({ ...p, collections: next });
    products++;
  }
  let categories = 0;
  if (to)
    for (const c of listCollections())
      if (c.rule.type === "tag" && from.has(c.rule.tag)) {
        saveCollection({ ...c, rule: { type: "tag", tag: to } });
        categories++;
      }
  return { products, categories };
}

export async function renameTag(from: string, to: string): Promise<ActionResult<{ products: number }>> {
  await guard();
  const { t: tr } = await getT();
  try {
    const a = clean(from);
    const b = clean(to).toLowerCase();
    if (!a || !b) return { ok: false, error: tr("catalog.actions.enterTag") };
    if (!TAG.test(b)) return { ok: false, error: tr("catalog.actions.tagChars") };
    if (a === b) return { ok: true, data: { products: 0 } };
    const r = retag(new Set([a]), b);
    published("Renamed tag", `${a} → ${b}`, `${r.products} products${r.categories ? `, ${r.categories} categories` : ""}`);
    return { ok: true, data: { products: r.products } };
  } catch (e) {
    return fail(e);
  }
}

export async function mergeTags(sources: string[], target: string): Promise<ActionResult<{ products: number }>> {
  await guard();
  const { t: tr } = await getT();
  try {
    const list = tagList(sources);
    const b = clean(target).toLowerCase();
    if (!list || !b) return { ok: false, error: tr("catalog.actions.chooseMerge") };
    if (!TAG.test(b)) return { ok: false, error: tr("catalog.actions.tagChars") };
    const from = new Set(list.map(clean).filter((t) => t && t !== b));
    if (!from.size) return { ok: false, error: tr("catalog.actions.pickOther") };
    const r = retag(from, b);
    published("Merged tags", `${[...from].join(", ")} → ${b}`, `${r.products} products`);
    return { ok: true, data: { products: r.products } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTags(tags: string[]): Promise<ActionResult<{ products: number }>> {
  await guard();
  const { t: tr } = await getT();
  try {
    const list = tagList(tags);
    if (!list) return { ok: false, error: tr("catalog.actions.chooseDelete") };
    const r = retag(new Set(list.map(clean).filter(Boolean)), null);
    published(list.length === 1 ? "Deleted tag" : `Deleted ${list.length} tags`, list.slice(0, 10).join(", "), `${r.products} products`);
    return { ok: true, data: { products: r.products } };
  } catch (e) {
    return fail(e);
  }
}

/** One click: an automatic category that lists every product with this tag. */
export async function categoryFromTag(tag: string): Promise<ActionResult<string>> {
  await guard();
  const { t: tr } = await getT();
  try {
    const t = clean(tag);
    if (!t) return { ok: false, error: tr("catalog.actions.invalidTag") };
    if (!listProducts().some((p) => p.collections.includes(t))) return { ok: false, error: tr("catalog.actions.tagUnused") };
    const all = listCollections();
    const base = slugify(t) || "category";
    let handle = base;
    for (let i = 2; all.some((c) => c.handle === handle); i++) handle = `${base}-${i}`;
    const title = t.replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (m) => m.toUpperCase());
    saveCollection({ handle, title, description: "", image: "", rule: { type: "tag", tag: t } });
    published("Created category", title, `From tag “${t}”`);
    return { ok: true, data: handle };
  } catch (e) {
    return fail(e);
  }
}
