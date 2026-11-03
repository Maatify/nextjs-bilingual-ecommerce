import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { sniff } from "./review-photos";
import { MEDIA_DIR, saveMedia, type MediaItem } from "./store";

type Sharp = typeof import("sharp").default;
const sharp = createRequire(import.meta.url)("sharp") as Sharp;

/**
 * Store an uploaded image as WebP (≤1200px) + a 480px sibling, matching the
 * image loader's "-480.webp" convention so next/image picks the small file on phones.
 * `productShot` pads to a 4:5 canvas on the store's well colour like the catalog photos.
 */
export async function storeUpload(file: File, opts: { productShot?: boolean } = {}): Promise<MediaItem> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be uploaded");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image is larger than 12 MB");
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const id = `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const input = Buffer.from(await file.arrayBuffer());
  // trust the bytes, not the browser's MIME type: raster formats only (no SVG → no librsvg parsing, no script)
  const raster = !!sniff(input) || input.toString("ascii", 0, 4) === "GIF8" || (input.toString("ascii", 4, 8) === "ftyp" && /^avi[fs]$/.test(input.toString("ascii", 8, 12)));
  if (!raster) throw new Error("Use a JPG, PNG, WebP, AVIF or GIF image");
  const base = opts.productShot
    ? sharp(input, { limitInputPixels: 50_000_000 }).rotate().resize(960, 1200, { fit: "contain", background: "#f4f4f2" }).flatten({ background: "#f4f4f2" })
    : sharp(input, { limitInputPixels: 50_000_000 }).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true });
  const big = await base.clone().webp({ quality: 76 }).toBuffer({ resolveWithObject: true });
  await fs.writeFile(path.join(MEDIA_DIR, `${id}.webp`), big.data);
  await base.clone().resize({ width: 480 }).webp({ quality: 70 }).toFile(path.join(MEDIA_DIR, `${id}-480.webp`));
  const item: MediaItem = { id, url: `/media/${id}.webp`, name: file.name, width: big.info.width, height: big.info.height, size: big.info.size, createdAt: new Date().toISOString() };
  saveMedia(item);
  return item;
}

export async function removeUpload(id: string) {
  await Promise.allSettled([fs.unlink(path.join(MEDIA_DIR, `${id}.webp`)), fs.unlink(path.join(MEDIA_DIR, `${id}-480.webp`))]);
}
