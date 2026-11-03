#!/usr/bin/env node
/**
 * npm run optimize:images [-- <dir|file> … ] [--dry] [--webp]
 *
 * Compresses storefront images without visible quality loss. Default target: public/.
 *
 * Per raster image (JPEG / PNG / WebP / AVIF):
 *   1. resize to max 2000 px on the long edge (never upscales), convert to sRGB, strip EXIF/XMP/ICC metadata;
 *   2. re-encode in the SAME format (file names never change, so no code/DB reference breaks):
 *      WebP q90→100 (effort 6, smartSubsample) · JPEG mozjpeg q90→100 · AVIF q90→100 · PNG lossless (max zlib, adaptive filtering);
 *   3. quality gate — SSIMULACRA2 (calc-s2-rust, WASM) of the candidate vs the original pixels must be ≥ 90;
 *      quality is raised step by step until it passes; if nothing passes, or the result isn't smaller, the
 *      original is kept untouched. Lossless PNG output is pixel-identical (score 100).
 *   With --webp, JPEG/PNG photos are written as a .webp SIBLING (original kept) and the script prints the
 *   references you must update — use it for new images before they are referenced anywhere.
 * SVGs: svgo (multipass, preset-default — v4 keeps viewBox), written only when smaller.
 * Share images (opengraph/twitter/og-*) are only resized/recompressed in their own JPEG/PNG format.
 *
 * Every overwritten file is first copied to _image_backup/<same path> (gitignored); a per-file report is written
 * to _image_report.csv (file, old size, new size, format, score, action).
 */
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const sharp = require("sharp");
sharp.cache(false);

const MAX_EDGE = 2000;
const GATE = 90; // SSIMULACRA2: ≥ 90 ≈ visually lossless
const QUALITIES = [90, 92, 94, 96, 98, 100];
const RASTER = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const TO_WEBP = args.includes("--webp");
const targets = args.filter((a) => !a.startsWith("--"));
if (!targets.length) targets.push("public");

/* ── SSIMULACRA2 (WASM, no native deps) ── */
const s2 = await import(pathToFileURL(require.resolve("calc-s2-rust/calc_s2_rust.js")).href);
const wasm = s2.initSync(readFileSync(path.join(path.dirname(require.resolve("calc-s2-rust/calc_s2_rust.js")), "calc_s2_rust_bg.wasm")));
const quiet = (fn) => {
  const log = console.log;
  console.log = () => {}; // the WASM build prints debug lines for every buffer
  try {
    return fn();
  } finally {
    console.log = log;
  }
};
const rgb = (input) => sharp(input).toColorspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
async function ssimulacra2(refRaw, candidate) {
  const b = await rgb(candidate);
  if (b.info.width !== refRaw.info.width || b.info.height !== refRaw.info.height) return 0;
  return quiet(() => {
    for (const [key, buf] of [["ref", refRaw.data], ["cand", b.data]]) {
      const ptr = s2.new_buffer(key, buf.length);
      new Uint8Array(wasm.memory.buffer, ptr, buf.length).set(buf);
    }
    const score = s2.calc_s2("ref", "cand", refRaw.info.width, refRaw.info.height);
    s2.remove_buffer("ref");
    s2.remove_buffer("cand");
    return score;
  });
}

const encode = (pipeline, fmt, q) => {
  const p = pipeline.clone();
  if (fmt === "webp") return p.webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer();
  if (fmt === "jpeg") return p.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  if (fmt === "avif") return p.avif({ quality: q, effort: 9 }).toBuffer();
  return p.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 }).toBuffer(); // lossless
};

async function walk(p) {
  const st = await fs.stat(p);
  if (st.isFile()) return [p];
  const out = [];
  for (const e of await fs.readdir(p, { withFileTypes: true })) out.push(...(await walk(path.join(p, e.name))));
  return out;
}

async function backup(abs) {
  const dest = path.join(ROOT, "_image_backup", path.relative(ROOT, abs));
  if (existsSync(dest)) return; // keep the very first original
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(abs, dest);
}

async function optimizeRaster(abs, original) {
  const ext = path.extname(abs).toLowerCase();
  const meta = await sharp(original).metadata();
  const srcFmt = ext === ".jpg" || ext === ".jpeg" ? "jpeg" : ext.slice(1);
  const isShare = /(opengraph|twitter|og)[-_.]/i.test(path.basename(abs));
  const outFmt = TO_WEBP && !isShare && (srcFmt === "jpeg" || (srcFmt === "png" && !meta.hasAlpha)) ? "webp" : srcFmt;
  const long = Math.max(meta.width ?? 0, meta.height ?? 0);
  const resized = long > MAX_EDGE;
  // .rotate() bakes EXIF orientation in before the metadata is dropped; sharp converts to sRGB on output.
  let pipeline = sharp(original).rotate().toColorspace("srgb");
  if (resized) pipeline = pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const refRaw = await rgb(await pipeline.clone().png().toBuffer());

  if (outFmt === "png") {
    const buf = await encode(pipeline, "png");
    return { buf, fmt: "png", q: "lossless", score: 100, resized };
  }
  for (const q of QUALITIES) {
    const buf = await encode(pipeline, outFmt, q);
    // higher quality only grows the file — once it isn't smaller than the original, stop (unless resizing)
    if (!resized && outFmt === srcFmt && buf.length >= original.length) return { buf: null, fmt: outFmt, q, score: null, resized, why: "re-encode not smaller" };
    const score = await ssimulacra2(refRaw, buf);
    if (score >= GATE) return { buf, fmt: outFmt, q, score, resized };
  }
  return { buf: null, fmt: outFmt, q: null, score: null, resized, why: `no quality ≤100 reached SSIMULACRA2 ${GATE}` };
}

async function optimizeSvg(abs, original) {
  const { optimize } = await import(pathToFileURL(require.resolve("svgo")).href);
  const out = optimize(original.toString("utf8"), {
    path: abs,
    multipass: true,
    plugins: ["preset-default"], // svgo 4 keeps viewBox by default
  });
  return Buffer.from(out.data);
}

const rows = [["file", "old_bytes", "new_bytes", "format", "quality", "ssimulacra2", "action"]];
let before = 0;
let after = 0;
const toUpdate = [];

for (const t of targets) {
  const files = (await walk(path.resolve(ROOT, t))).filter((f) => RASTER.has(path.extname(f).toLowerCase()) || f.endsWith(".svg"));
  for (const abs of files) {
    const rel = path.relative(ROOT, abs);
    const original = await fs.readFile(abs);
    before += original.length;
    try {
      if (abs.endsWith(".svg")) {
        const buf = await optimizeSvg(abs, original);
        if (buf.length < original.length) {
          if (!DRY) {
            await backup(abs);
            await fs.writeFile(abs, buf);
          }
          rows.push([rel, original.length, buf.length, "svg", "", "", "svgo"]);
          after += buf.length;
        } else {
          rows.push([rel, original.length, original.length, "svg", "", "", "kept (already minimal)"]);
          after += original.length;
        }
        continue;
      }
      const r = await optimizeRaster(abs, original);
      if (!r.buf || (!r.resized && r.buf.length >= original.length)) {
        rows.push([rel, original.length, original.length, r.fmt, r.q ?? "", r.score?.toFixed(2) ?? "", `kept original (${r.why ?? "not smaller"})`]);
        after += original.length;
        continue;
      }
      const dest = r.fmt !== path.extname(abs).slice(1).replace("jpg", "jpeg") && r.fmt === "webp" ? abs.replace(/\.(jpe?g|png)$/i, ".webp") : abs;
      if (!DRY) {
        if (dest === abs) await backup(abs);
        await fs.writeFile(dest, r.buf);
      }
      if (dest !== abs) toUpdate.push([rel, path.relative(ROOT, dest)]);
      rows.push([path.relative(ROOT, dest), original.length, r.buf.length, r.fmt, r.q, r.score.toFixed(2), r.resized ? `resized ≤${MAX_EDGE}px + re-encoded` : "re-encoded"]);
      after += r.buf.length;
    } catch (e) {
      rows.push([rel, original.length, original.length, "", "", "", `error: ${e.message}`]);
      after += original.length;
    }
  }
}

const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\n");
if (!DRY) await fs.writeFile(path.join(ROOT, "_image_report.csv"), csv + "\n");
const changed = rows.slice(1).filter((r) => !String(r[6]).startsWith("kept") && !String(r[6]).startsWith("error")).length;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`${rows.length - 1} files · ${changed} optimized · ${kb(before)} → ${kb(after)}${DRY ? " (dry run)" : " · report: _image_report.csv"}`);
if (toUpdate.length) {
  console.log("\nWritten as .webp siblings — update these references (code + admin/DB), then delete the originals:");
  for (const [from, to] of toUpdate) console.log(`  ${from} → ${to}`);
}
