"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import { deleteCollection as dbDelete, listCollections, reorderCollections as dbReorder, saveCollection as dbSave } from "@/server/store";
import { getT } from "@/lib/i18n/admin/server";
import type { Collection, CollectionAr } from "@/lib/types";

/* Categories = the store's collections, with an optional parent (WooCommerce-style hierarchy). */

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RULES = ["all", "sale", "tag", "manual"];
const handleList = (v: unknown): string[] | null => (Array.isArray(v) && v.length <= 1000 && v.every((h) => typeof h === "string" && h.length <= 100) ? v : null);

/** Would making `parent` the parent of `handle` create a loop? */
function createsCycle(all: Collection[], handle: string, parent: string) {
  const byHandle = new Map(all.map((c) => [c.handle, c]));
  let cur: string | undefined = parent;
  for (let i = 0; cur && i < 100; i++) {
    if (cur === handle) return true;
    cur = byHandle.get(cur)?.parent;
  }
  return false;
}

/** Arabic overrides: trimmed, capped like the English fields, empty strings dropped (storefront falls back to English). */
function cleanAr(v: unknown): CollectionAr | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const s = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) || undefined : undefined);
  const ar: CollectionAr = { title: s(o.title, 200), description: s(o.description, 5000), seoTitle: s(o.seoTitle, 200), seoDescription: s(o.seoDescription, 500) };
  for (const k of Object.keys(ar) as (keyof CollectionAr)[]) if (ar[k] === undefined) delete ar[k];
  return Object.keys(ar).length ? ar : undefined;
}

export async function saveCategory(input: Collection, previousHandle?: string): Promise<ActionResult<Collection>> {
  await guard();
  const { t } = await getT();
  try {
    if (!input || typeof input !== "object" || typeof input.title !== "string" || typeof input.handle !== "string") throw new Error(t("catalog.actions.invalidCategory"));
    if (previousHandle !== undefined && typeof previousHandle !== "string") throw new Error(t("catalog.actions.invalidCategory"));
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const c: Collection = {
      handle: input.handle.trim().slice(0, 100),
      title: input.title.trim().slice(0, 200),
      description: str(input.description, 5000),
      image: str(input.image, 500),
      rule: input.rule,
      hidden: input.hidden === true || undefined,
      parent: str(input.parent, 100) || undefined,
      seoTitle: str(input.seoTitle, 200) || undefined,
      seoDescription: str(input.seoDescription, 500) || undefined,
      ar: cleanAr(input.ar),
    };
    if (c.image && !/^(\/(?!\/)|https:\/\/)/i.test(c.image)) throw new Error(t("catalog.actions.invalidImage"));
    if (!c.rule || typeof c.rule !== "object" || !RULES.includes(c.rule.type)) throw new Error(t("catalog.actions.invalidType"));
    if (c.rule.type === "tag") {
      if (typeof c.rule.tag !== "string" || !c.rule.tag.trim()) throw new Error(t("catalog.actions.chooseTag"));
      c.rule = { type: "tag", tag: c.rule.tag.trim().slice(0, 100) };
    } else if (c.rule.type === "manual") {
      if (!Array.isArray(c.rule.productIds) || c.rule.productIds.length > 2000 || c.rule.productIds.some((id) => typeof id !== "string" || id.length > 64)) throw new Error(t("catalog.actions.invalidList"));
      c.rule = { type: "manual", productIds: [...new Set(c.rule.productIds)] };
    } else c.rule = { type: c.rule.type };
    if (!c.title) throw new Error(t("catalog.categories.v.nameRequired"));
    if (!HANDLE.test(c.handle)) throw new Error(t("catalog.categories.v.slugChars"));
    const existing = listCollections();
    if (previousHandle && !existing.some((x) => x.handle === previousHandle)) throw new Error(t("catalog.actions.categoryNotFound"));
    if (c.handle !== previousHandle && existing.some((x) => x.handle === c.handle)) throw new Error(t("catalog.actions.slugTaken", { slug: c.handle }));
    if (c.parent) {
      if (!existing.some((x) => x.handle === c.parent)) throw new Error(t("catalog.actions.parentNotFound"));
      if (c.parent === c.handle || c.parent === previousHandle || createsCycle(existing, previousHandle ?? c.handle, c.parent)) throw new Error(t("catalog.actions.ownParent"));
    }
    dbSave(c, previousHandle);
    if (previousHandle && previousHandle !== c.handle) {
      // renaming re-inserts the row — keep its place, and re-point children at the new slug
      dbReorder(existing.map((x) => (x.handle === previousHandle ? c.handle : x.handle)));
      for (const child of existing.filter((x) => x.parent === previousHandle)) dbSave({ ...child, parent: c.handle });
    }
    published(previousHandle ? "Updated category" : "Created category", c.title);
    return { ok: true, data: c };
  } catch (e) {
    return fail(e);
  }
}

/** Quick edit (WordPress-style): name + slug only. */
export async function quickEditCategory(handle: string, title: string, newHandle: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  const c = typeof handle === "string" ? listCollections().find((x) => x.handle === handle) : undefined;
  if (!c) return { ok: false, error: t("catalog.actions.categoryNotFound") };
  if (typeof title !== "string" || typeof newHandle !== "string") return { ok: false, error: t("common.errors.invalidInput") };
  const res = await saveCategory({ ...c, title, handle: newHandle }, handle);
  return res.ok ? { ok: true } : res;
}

/** Delete categories; children move up to the deleted category's parent (like WooCommerce). */
export async function deleteCategories(handles: string[]): Promise<ActionResult<number>> {
  await guard();
  const { t } = await getT();
  try {
    const list = handleList(handles);
    if (!list) return { ok: false, error: t("catalog.actions.invalidSelection") };
    const all = listCollections();
    const doomed = new Set(list);
    const byHandle = new Map(all.map((c) => [c.handle, c]));
    const survivingParent = (h: string | undefined): string | undefined => {
      let cur = h;
      for (let i = 0; cur && doomed.has(cur) && i < 100; i++) cur = byHandle.get(cur)?.parent;
      return cur && !doomed.has(cur) ? cur : undefined;
    };
    for (const c of all) if (!doomed.has(c.handle) && c.parent && doomed.has(c.parent)) dbSave({ ...c, parent: survivingParent(c.parent) });
    let n = 0;
    for (const h of list)
      if (byHandle.has(h)) {
        dbDelete(h);
        n++;
      }
    published(n === 1 ? "Deleted category" : `Deleted ${n} categories`, n === 1 ? byHandle.get(list[0])?.title : undefined);
    return { ok: true, data: n };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderCategories(handles: string[]): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    const list = handleList(handles);
    if (!list) return { ok: false, error: t("catalog.actions.invalidOrder") };
    const known = new Set(listCollections().map((c) => c.handle));
    dbReorder(list.filter((h) => known.has(h)));
    published("Reordered categories");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
