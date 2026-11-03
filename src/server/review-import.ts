import { randomUUID } from "node:crypto";
import type { AdminKey } from "@/lib/i18n/admin";
import type { Product, ReviewSource, StoredReview } from "@/lib/types";

/*
 * CSV import of REAL reviews collected elsewhere (Instagram DMs, WhatsApp, Google, TikTok…).
 * Columns: handle, rating, title, body, author, city, date, source. Header row required (any order,
 * case-insensitive; "product handle" / "product" also accepted for handle). Imported reviews are never marked
 * "Verified buyer": only a review sent from a personal review link (tied to a delivered order) or by a shopper whose
 * phone number matches an order can be. Any other column, including an old "verified" column, is ignored.
 */

export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_ROWS = 500;
export const IMPORT_COLUMNS = ["handle", "rating", "title", "body", "author", "city", "date", "source"] as const;
const REQUIRED = ["handle", "rating", "body", "author"] as const;
const SOURCES: ReviewSource[] = ["instagram", "whatsapp", "google", "tiktok", "other"];

/** RFC 4180-ish parser: quoted fields, doubled quotes, CRLF/LF, a leading BOM; `;` or tab also accepted as separator. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = [",", ";", "\t"].map((c) => ({ c, n: firstLine.split(c).length })).sort((a, b) => b.n - a.n)[0].c;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') (cell += '"'), i++;
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) (row.push(cell), (cell = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) (row.push(cell), rows.push(row));
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ImportRow {
  line: number;
  handle: string;
  productId?: string;
  productTitle?: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  city: string;
  date: string;
  source: ReviewSource;
  errors: { key: AdminKey; vars?: Record<string, string> }[];
}

const clean = (v: string | undefined, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z]/g, "");
const HEADER_ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = { handle: "handle", producthandle: "handle", product: "handle", rating: "rating", stars: "rating", title: "title", body: "body", review: "body", text: "body", author: "author", name: "author", city: "city", date: "date", source: "source" };

export type ImportResult = { ok: true; rows: ImportRow[] } | { ok: false; error: { key: AdminKey; vars?: Record<string, string> } };

/** Parse + validate every row (nothing is written). */
export function validateImport(text: string, products: Product[], existing: StoredReview[], today: string): ImportResult {
  if (text.length > IMPORT_MAX_BYTES) return { ok: false, error: { key: "reviews.import.tooBig" } };
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false, error: { key: "reviews.import.noRows" } };
  const header = table[0].map((h) => HEADER_ALIASES[norm(h)]);
  for (const col of REQUIRED) if (!header.includes(col)) return { ok: false, error: { key: "reviews.import.err.header", vars: { col } } };
  if (table.length - 1 > IMPORT_MAX_ROWS) return { ok: false, error: { key: "reviews.import.err.tooMany" } };
  const byHandle = new Map(products.map((p) => [p.handle.toLowerCase(), p]));
  const seen = new Set(existing.map((r) => `${r.productId}|${r.author.trim().toLowerCase()}|${r.body.trim().toLowerCase()}`));
  const rows = table.slice(1).map((cells, i): ImportRow => {
    const get = (c: (typeof IMPORT_COLUMNS)[number]) => {
      const idx = header.indexOf(c);
      return idx === -1 ? "" : (cells[idx] ?? "");
    };
    const errors: ImportRow["errors"] = [];
    const handle = clean(get("handle"), 120);
    const p = byHandle.get(handle.toLowerCase());
    if (!p) errors.push({ key: "reviews.import.err.handle", vars: { value: handle || "—" } });
    const ratingRaw = clean(get("rating"), 4);
    const rating = Number(ratingRaw);
    if (!/^[1-5]$/.test(ratingRaw)) errors.push({ key: "reviews.import.err.rating" });
    const body = (get("body") ?? "").trim().slice(0, 2000);
    if (body.length < 3) errors.push({ key: "reviews.import.err.body" });
    const author = clean(get("author"), 60);
    if (!author) errors.push({ key: "reviews.import.err.author" });
    const dateRaw = clean(get("date"), 20);
    const date = dateRaw || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date > today) errors.push({ key: "reviews.import.err.date" });
    const srcRaw = clean(get("source"), 20).toLowerCase() || "other";
    const source = SOURCES.find((s) => s === srcRaw);
    if (!source) errors.push({ key: "reviews.import.err.source" });
    if (p && body && author) {
      const k = `${p.id}|${author.toLowerCase()}|${body.toLowerCase()}`;
      if (seen.has(k)) errors.push({ key: "reviews.import.err.duplicate" });
      seen.add(k);
    }
    return { line: i + 2, handle, productId: p?.id, productTitle: p?.title, rating, title: clean(get("title"), 120), body, author, city: clean(get("city"), 60), date, source: source ?? "other", errors };
  });
  return { ok: true, rows };
}

/** A valid row → a stored review (imported reviews say nothing about fit, so they're kept out of the fit split). */
export function rowToReview(r: ImportRow, status: StoredReview["status"]): StoredReview {
  return {
    id: `${r.productId}-i${randomUUID().slice(0, 8)}`,
    productId: r.productId!,
    author: r.author,
    city: r.city,
    rating: r.rating,
    title: r.title,
    body: r.body,
    date: r.date,
    verified: false,
    size: "",
    height: 0,
    weight: 0,
    fit: "true",
    fitUnknown: true,
    helpful: 0,
    status,
    source: r.source,
  };
}
