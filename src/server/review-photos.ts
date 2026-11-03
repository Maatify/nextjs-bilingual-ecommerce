import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { MEDIA_DIR } from "./store";

type Sharp = typeof import("sharp").default;
const sharp = createRequire(import.meta.url)("sharp") as Sharp;

/*
 * Customer review photos. Kept out of the admin media library: they live in data/uploads/reviews and are
 * served by the existing /media route (/media/reviews/<id>.webp + a -480 sibling for the image loader).
 * Every upload is sniffed by its magic bytes (the browser's MIME type is not trusted), decoded and
 * re-encoded by sharp to WebP — which drops EXIF/GPS and any other metadata.
 */

export const REVIEW_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const REVIEW_PHOTOS_PER_REVIEW = 3;
const DIR = path.join(MEDIA_DIR, "reviews");
const URL_RE = /^\/media\/reviews\/(rv_[a-z0-9]{16})\.webp$/;

export type PhotoError = "type" | "size" | "decode";

/** jpg / png / webp / heic-heif by signature; anything else is rejected before decoding. */
export function sniff(buf: Buffer): "jpeg" | "png" | "webp" | "heic" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(buf.toString("ascii", 8, 12))) return "heic";
  return null;
}

/** Validate without writing anything (so a bad file fails the whole submission before any review is stored). */
export async function checkReviewPhoto(file: File): Promise<{ ok: true; buf: Buffer } | { ok: false; error: PhotoError }> {
  if (file.size > REVIEW_PHOTO_MAX_BYTES) return { ok: false, error: "size" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > REVIEW_PHOTO_MAX_BYTES) return { ok: false, error: "size" };
  const kind = sniff(buf);
  if (!kind) return { ok: false, error: "type" };
  try {
    // HEIC (iPhone) decodes only when this sharp build has a HEVC-capable libheif — otherwise it's reported as unsupported
    const meta = await sharp(buf, { limitInputPixels: 50_000_000 }).metadata();
    if (!meta.width || !meta.height) return { ok: false, error: "decode" };
  } catch {
    return { ok: false, error: kind === "heic" ? "type" : "decode" };
  }
  return { ok: true, buf };
}

/** Re-encode a checked photo to WebP (≤1200px + 480px sibling, metadata stripped). Returns its public URL. */
export async function storeReviewPhoto(buf: Buffer): Promise<string> {
  await fs.mkdir(DIR, { recursive: true });
  const id = `rv_${randomBytes(8).toString("hex")}`;
  const base = sharp(buf, { limitInputPixels: 50_000_000 }).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true });
  await base.clone().webp({ quality: 76 }).toFile(path.join(DIR, `${id}.webp`));
  await base.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 70 }).toFile(path.join(DIR, `${id}-480.webp`));
  return `/media/reviews/${id}.webp`;
}

export const isReviewPhotoUrl = (url: unknown): url is string => typeof url === "string" && URL_RE.test(url);

/** Delete a review photo (both sizes). Only ever touches files under data/uploads/reviews. */
export async function removeReviewPhoto(url: string) {
  const m = URL_RE.exec(url);
  if (!m) return;
  await Promise.allSettled([fs.unlink(path.join(DIR, `${m[1]}.webp`)), fs.unlink(path.join(DIR, `${m[1]}-480.webp`))]);
}

/** Localised message for a rejected photo. */
export function photoErrorMessage(L: (en: string, ar: string) => string, e: PhotoError | "count") {
  if (e === "count") return L(`Add up to ${REVIEW_PHOTOS_PER_REVIEW} photos`, `آخرك ${REVIEW_PHOTOS_PER_REVIEW} صور`);
  if (e === "size") return L("Each photo must be 8 MB or smaller", "فيه صورة أكبر من 8 ميجا، اختار صورة أصغر");
  if (e === "type") return L("Use a JPG, PNG or WebP photo (this format isn't supported)", "الصورة لازم تكون JPG أو PNG أو WebP");
  return L("We couldn't read one of the photos — try another", "فيه صورة مش بتفتح عندنا، جرّب صورة تانية");
}

/** "Nour Hassan" → "Nour H." — reviews show a first name and initial only. */
export function displayName(raw: string) {
  const [first, ...rest] = raw.split(" ").filter(Boolean);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

