import fs from "node:fs";
import path from "node:path";

let cached: string | null | undefined;

/**
 * URL of the built Cairo *Arabic-subset* woff2, so Arabic pages can preload it.
 *
 * Cairo is loaded with next/font `preload: false` (English visitors never download it), but without a preload the
 * browser only discovers it after CSS + layout, and the swap from the fallback Arabic face (narrower) re-wraps the hero
 * title/eyebrow — Lighthouse measured CLS 0.69 on /ar. next/font doesn't expose the hashed file URL, so read it once
 * from the emitted CSS (the @font-face whose unicode-range starts at U+6??). Returns null if not found → no preload.
 */
export function arabicFontHref(): string | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    const dir = path.join(process.cwd(), ".next", "static", "chunks");
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".css")) continue;
      const css = fs.readFileSync(path.join(dir, f), "utf8");
      for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
        if (!/font-family:\s*["']?Cairo["']?\s*;/.test(block) || !/unicode-range:\s*U\+6\?\?/.test(block)) continue;
        const m = block.match(/url\((?:\.\.\/media\/|\/_next\/static\/media\/)([^)"']+\.woff2)\)/);
        if (m) return (cached = `/_next/static/media/${m[1]}`);
      }
    }
  } catch {}
  return cached;
}
