"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getT } from "@/lib/i18n/admin/server";
import { removeUpload, storeUpload } from "@/server/media";
import { deleteMedia, listMedia, listProducts, type MediaItem } from "@/server/store";

const MEDIA_ID = /^m_[a-z0-9]{1,32}$/;
const MAX_FILES = 50;

export interface LibraryImage {
  url: string;
  name: string;
  source: "upload" | "catalog";
  id?: string;
  width?: number;
  height?: number;
  size?: number;
  createdAt?: string;
  usedBy?: string[];
}

/** Everything pickable: admin uploads + the built-in catalog photos in /public/p. */
export async function listLibrary(): Promise<LibraryImage[]> {
  await guard();
  const products = listProducts();
  const usage = new Map<string, string[]>();
  for (const p of products) for (const c of p.colors) for (const u of c.images) usage.set(u, [...(usage.get(u) ?? []), `${p.title} · ${c.name}`]);

  const uploads: LibraryImage[] = listMedia().map((m: MediaItem) => ({ url: m.url, name: m.name, source: "upload", id: m.id, width: m.width, height: m.height, size: m.size, createdAt: m.createdAt, usedBy: usage.get(m.url) }));
  const root = path.join(process.cwd(), "public", "p");
  const catalog: LibraryImage[] = [];
  try {
    for (const dir of await fs.readdir(root)) {
      for (const f of (await fs.readdir(path.join(root, dir))).sort()) {
        if (!f.endsWith(".webp") || f.endsWith("-480.webp")) continue;
        const url = `/p/${dir}/${f}`;
        catalog.push({ url, name: `${dir}/${f}`, source: "catalog", usedBy: usage.get(url) });
      }
    }
  } catch {
    /* no catalog folder */
  }
  return [...uploads, ...catalog];
}

export async function uploadImages(form: FormData): Promise<ActionResult<LibraryImage[]>> {
  await guard();
  const { t: tr } = await getT();
  try {
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_FILES) return { ok: false, error: tr("catalog.actions.maxFiles", { count: MAX_FILES }) };
    const productShot = form.get("productShot") === "1";
    const out: LibraryImage[] = [];
    for (const f of files) {
      const m = await storeUpload(f, { productShot });
      out.push({ url: m.url, name: m.name, source: "upload", id: m.id, width: m.width, height: m.height, size: m.size, createdAt: m.createdAt });
    }
    published("Uploaded media", `${out.length} image${out.length === 1 ? "" : "s"}`);
    return { ok: true, data: out };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteImage(id: string): Promise<ActionResult> {
  await guard();
  const { t: tr } = await getT();
  try {
    // id is joined into a filesystem path by removeUpload — only accept ids storeUpload generates
    if (typeof id !== "string" || !MEDIA_ID.test(id)) return { ok: false, error: tr("catalog.actions.invalidMedia") };
    deleteMedia(id);
    await removeUpload(id);
    published("Deleted media", id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
