import fs from "node:fs/promises";
import path from "node:path";
import { MEDIA_DIR } from "@/server/store";

/** Every upload is re-encoded by sharp, so only raster types are ever served — never SVG/HTML (stored XSS). */
const TYPES: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const notFound = () => new Response("Not found", { status: 404, headers: { "x-content-type-options": "nosniff" } });

/** Serves admin-uploaded media from data/uploads (public/ is frozen at build time). */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  if (!parts?.length || parts.length > 3 || parts.some((p) => !/^[\w-]+(?:\.[a-z0-9]+)?$/i.test(p))) return notFound();
  const file = path.join(MEDIA_DIR, ...parts);
  if (!file.startsWith(MEDIA_DIR + path.sep)) return notFound();
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return notFound();
  try {
    const buf = await fs.readFile(file);
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return notFound();
  }
}
