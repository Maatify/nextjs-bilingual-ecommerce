import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SEED_COLLECTIONS, SEED_PRODUCTS } from "@/lib/seed/catalog";
import { SEED_SETTINGS, seedContent } from "@/lib/seed/content";
import { adjustStock, normalizeVariants, reconcileSizeEdits, variantsFromSizes } from "@/lib/variants";
import type {
  Collection,
  Order,
  OrderStatus,
  Product,
  StoreContent,
  StoreSettings,
  StoreSnapshot,
  StoredReview,
  ReviewSettings,
} from "@/lib/types";

/*
 * Single-file SQLite store (node:sqlite, no native deps). Documents are kept as
 * JSON in `data` columns with a few indexed scalar columns for querying.
 * Swap this module for Postgres/Supabase later — the rest of the app only uses
 * the exported functions.
 */

const DB_PATH = process.env.VERDA_DB ?? path.join(process.cwd(), "data", "verda.db");
// Vercel starts every instance with an empty /tmp: copy the catalog snapshot (scripts/db-snapshot.mjs) into place first.
// linkSync fails if the DB already exists, so concurrent build workers / cold starts never replace an open file.
// turbopackIgnore: DB_PATH is env-driven; without the hint Turbopack traces the whole project (public/, src/) into
// every server function. The snapshot itself is shipped via next.config outputFileTracingIncludes.
const DB_SNAPSHOT = path.join(process.cwd(), "deploy", "verda.db");
function restoreSnapshot() {
  if (!process.env.VERCEL || fs.existsSync(/*turbopackIgnore: true*/ DB_PATH) || !fs.existsSync(DB_SNAPSHOT)) return;
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  fs.copyFileSync(DB_SNAPSHOT, tmp);
  try { fs.linkSync(tmp, /*turbopackIgnore: true*/ DB_PATH); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  fs.rmSync(tmp, { force: true });
}

type G = typeof globalThis & { __verdaDb?: DatabaseSync; __verdaStore?: { snapshot: () => StoreSnapshot }; __verdaCache?: { v: number; snap: StoreSnapshot | null } };
const g = globalThis as G;

export function getDb() {
  return open();
}

/**
 * Run `fn` in ONE write transaction (BEGIN IMMEDIATE takes the write lock up front, so two concurrent
 * requests can't both read the same pre-state and both apply a stock change). Re-entrant: a nested call
 * just joins the outer transaction. Throwing rolls everything back.
 */
let txDepth = 0;
export function withTx<T>(fn: () => T): T {
  const db = open();
  if (txDepth > 0) return fn();
  db.exec("BEGIN IMMEDIATE");
  txDepth++;
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    txDepth--;
  }
}

/** SQLITE_BUSY / SQLITE_LOCKED (incl. extended codes) */
const isBusy = (e: unknown) => {
  const code = (e as { errcode?: number }).errcode;
  return typeof code === "number" && ((code & 0xff) === 5 || (code & 0xff) === 6);
};
const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Open (and on first use create, seed and migrate) the store. A fresh database is opened by several processes at
 * once (`next build` collects page data in parallel workers). SQLite can answer SQLITE_BUSY without waiting for
 * busy_timeout while another connection switches the file to WAL or holds the write lock, so the whole idempotent
 * init is retried with a short back-off instead of failing the build.
 */
function open() {
  if (g.__verdaDb) return g.__verdaDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  restoreSnapshot();
  for (let attempt = 1; ; attempt++) {
    const db = new DatabaseSync(DB_PATH);
    try {
      return init(db);
    } catch (e) {
      g.__verdaDb = undefined;
      try {
        db.close();
      } catch {}
      if (!isBusy(e) || attempt >= 40) throw e;
      sleepSync(50 + Math.floor(Math.random() * 200));
    }
  }
}

function init(db: DatabaseSync) {
  db.exec(`
    PRAGMA busy_timeout = 4000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, handle TEXT UNIQUE NOT NULL, status TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collections (handle TEXT PRIMARY KEY, position INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL, phone TEXT NOT NULL, total INTEGER NOT NULL, demo INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS orders_phone ON orders(phone);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, url TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, contact TEXT UNIQUE NOT NULL, source TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS reviews_product ON reviews(product_id, status);
    CREATE TABLE IF NOT EXISTS review_requests (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, order_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, revoked_at TEXT);
    CREATE INDEX IF NOT EXISTS review_requests_order ON review_requests(order_id);
  `);
  g.__verdaDb = db;
  seedIfEmpty(db);
  migrateRealV1(db);
  migrateVariantsV1(db);
  return db;
}

const j = <T,>(s: string) => JSON.parse(s) as T;
const now = () => new Date().toISOString();

/* ───────────────────────── cache / snapshot ───────────────────────── */

const cache = (g.__verdaCache ??= { v: 1, snap: null });
/** The snapshot also carries time-windowed numbers (sold in the last 24h), so it never lives longer than this. */
const SNAP_TTL = 5 * 60_000;
let snapBuiltAt = 0;

/** Invalidate the storefront snapshot after any write. */
export function bump() {
  cache.v++;
  cache.snap = null;
}

function kvGet<T>(key: string): T | null {
  const row = open().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? j<T>(row.value) : null;
}
function kvSet(key: string, value: unknown) {
  open().prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
}

export function snapshot(): StoreSnapshot {
  if (cache.snap && Date.now() - snapBuiltAt < SNAP_TTL) return cache.snap;
  if (cache.snap) cache.v++; // TTL expiry: new version so clients re-hydrate
  const db = open();
  const proof = socialProof();
  const products = (db.prepare("SELECT data FROM products WHERE status = 'active' ORDER BY position, id").all() as { data: string }[]).map((r) => {
    // unit cost is admin-only (margin reports) — keep it out of everything the storefront renders or serialises
    const { cost: _cost, ...p } = j<Product>(r.data);
    void _cost;
    return withProof(p, proof);
  });
  const collections = (db.prepare("SELECT data FROM collections ORDER BY position, handle").all() as { data: string }[]).map((r) => j<Collection>(r.data));
  const reviews = (db.prepare("SELECT data FROM reviews WHERE status = 'published' ORDER BY created_at DESC").all() as { data: string }[]).map((r) => j<StoredReview>(r.data));
  cache.snap = { version: cache.v, products, collections, settings: getSettings(), content: getContent(), reviews };
  snapBuiltAt = Date.now();
  return cache.snap;
}

/* ───────────────────────── derived social proof ───────────────────────── */

export interface ProductProof {
  rating: number;
  reviewCount: number;
  sold24h: number;
  fitSplit: [number, number, number] | null;
  fitReviews: number;
}
type ProofMap = Map<string, ProductProof>;

/**
 * Rating, review count and fit split come only from PUBLISHED reviews; "sold in 24h"
 * only from real, non-cancelled orders. Nothing here is ever typed in by hand.
 */
function socialProof(): ProofMap {
  const db = open();
  const out: ProofMap = new Map();
  const get = (id: string) => {
    let x = out.get(id);
    if (!x) out.set(id, (x = { rating: 0, reviewCount: 0, sold24h: 0, fitSplit: null, fitReviews: 0 }));
    return x;
  };
  const fits = new Map<string, [number, number, number]>();
  for (const row of db.prepare("SELECT product_id AS id, data FROM reviews WHERE status = 'published'").all() as { id: string; data: string }[]) {
    const r = j<StoredReview>(row.data);
    const x = get(row.id);
    x.rating += r.rating;
    x.reviewCount++;
    // imported / link reviews that didn't say how it fits don't count towards the fit split
    if (r.fitUnknown) continue;
    const f = (fits.get(row.id) ?? [0, 0, 0]) as [number, number, number];
    f[r.fit === "small" ? 0 : r.fit === "large" ? 2 : 1]++;
    fits.set(row.id, f);
  }
  for (const [id, x] of out) {
    if (!x.reviewCount) continue;
    x.rating = Math.round((x.rating / x.reviewCount) * 10) / 10;
    const f = fits.get(id);
    const n = f ? f[0] + f[1] + f[2] : 0;
    if (!f || !n) continue;
    x.fitReviews = n;
    const pct = f.map((k) => Math.round((k / n) * 100)) as [number, number, number];
    pct[1] = 100 - pct[0] - pct[2];
    x.fitSplit = pct;
  }
  const since = new Date(Date.now() - 864e5).toISOString();
  for (const row of db.prepare("SELECT data FROM orders WHERE created_at >= ? AND status != 'cancelled' AND demo = 0").all(since) as { data: string }[])
    for (const l of j<Order>(row.data).lines) get(l.productId).sold24h += l.qty;
  return out;
}

function withProof(p: Product, proof: ProofMap): Product {
  const x = proof.get(p.id);
  return { ...p, rating: x?.rating ?? 0, reviewCount: x?.reviewCount ?? 0, sold24h: x?.sold24h ?? 0, fitSplit: x?.fitSplit ?? p.fitSplit, fitReviews: x?.fitReviews ?? 0 };
}

/** Computed (read-only) social proof for one product — shown in the admin product editor. */
export function productProof(id: string): ProductProof {
  return socialProof().get(id) ?? { rating: 0, reviewCount: 0, sold24h: 0, fitSplit: null, fitReviews: 0 };
}

// isomorphic accessors in src/lib/data.ts read through this
g.__verdaStore = { snapshot };

/* ───────────────────────── settings & content ───────────────────────── */

/**
 * NEXT_PUBLIC_SITE_URL, when set, is the one source for every absolute URL (canonical, sitemap, robots, OG, JSON-LD,
 * llms.txt, review links) and wins over Admin → Settings → Store URL. Unset → the admin value is used, as before.
 */
const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || "";
export const getSettings = (): StoreSettings => {
  const s = kvGet<StoreSettings>("settings") ?? SEED_SETTINGS;
  return ENV_SITE_URL ? { ...s, site: { ...s.site, url: ENV_SITE_URL } } : s;
};
export const getContent = () => kvGet<StoreContent>("content") ?? seedContent(SEED_SETTINGS);

export function saveSettings(next: StoreSettings) {
  kvSet("settings", next);
  bump();
}
export function saveContent(next: StoreContent) {
  kvSet("content", next);
  bump();
}

/* ───────────────────────── products ───────────────────────── */

export function listProducts(): Product[] {
  const proof = socialProof();
  return (open().prepare("SELECT data FROM products ORDER BY position, id").all() as { data: string }[]).map((r) => withProof(j<Product>(r.data), proof));
}
export function getProduct(id: string): Product | null {
  const r = open().prepare("SELECT data FROM products WHERE id = ?").get(id) as { data: string } | undefined;
  if (!r) return null;
  const p = j<Product>(r.data);
  const x = productProof(id);
  return { ...p, rating: x.rating, reviewCount: x.reviewCount, sold24h: x.sold24h, fitSplit: x.fitSplit ?? p.fitSplit, fitReviews: x.fitReviews };
}
/**
 * Persist a product. Variants are always normalized to the full colour × size grid and
 * `sizes[].stock` re-derived from them. A writer that only changed per-size totals
 * (legacy callers that don't know about variants) has those edits folded into the variants.
 */
export function saveProduct(input: Product) {
  const db = open();
  const prevRow = db.prepare("SELECT data FROM products WHERE id = ?").get(input.id) as { data: string } | undefined;
  const prev = prevRow ? j<Product>(prevRow.data) : null;
  const legacyWrite = !!prev && JSON.stringify(prev.variants ?? null) === JSON.stringify(input.variants ?? null);
  const p = normalizeVariants(legacyWrite && prev ? reconcileSizeEdits(input, prev) : input);
  const exists = prev ? { position: 0 } : undefined;
  const clash = db.prepare("SELECT id FROM products WHERE handle = ? AND id != ?").get(p.handle, p.id);
  if (clash) throw new Error(`Handle "${p.handle}" is already used by another product`);
  const data = JSON.stringify({ ...p, status: p.status ?? "active", updatedAt: now() });
  if (exists) db.prepare("UPDATE products SET handle = ?, status = ?, data = ? WHERE id = ?").run(p.handle, p.status ?? "active", data, p.id);
  else {
    const pos = (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS n FROM products").get() as { n: number }).n;
    db.prepare("INSERT INTO products (id, handle, status, position, data) VALUES (?, ?, ?, ?, ?)").run(p.id, p.handle, p.status ?? "active", pos, data);
  }
  bump();
  return p;
}
export function deleteProduct(id: string) {
  open().prepare("DELETE FROM products WHERE id = ?").run(id);
  bump();
}
export function reorderProducts(ids: string[]) {
  const db = open();
  const st = db.prepare("UPDATE products SET position = ? WHERE id = ?");
  ids.forEach((id, i) => st.run(i, id));
  bump();
}
export function newProductId() {
  const ids = (open().prepare("SELECT id FROM products").all() as { id: string }[]).map((p) => Number(p.id.replace(/\D/g, "")) || 0);
  return `p${String(Math.max(0, ...ids) + 1).padStart(2, "0")}`;
}

/* ───────────────────────── collections ───────────────────────── */

export function listCollections(): Collection[] {
  return (open().prepare("SELECT data FROM collections ORDER BY position, handle").all() as { data: string }[]).map((r) => j<Collection>(r.data));
}
export function saveCollection(c: Collection, previousHandle?: string) {
  const db = open();
  if (previousHandle && previousHandle !== c.handle) db.prepare("DELETE FROM collections WHERE handle = ?").run(previousHandle);
  const pos = (db.prepare("SELECT position FROM collections WHERE handle = ?").get(c.handle) as { position: number } | undefined)?.position ?? (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS n FROM collections").get() as { n: number }).n;
  db.prepare("INSERT INTO collections (handle, position, data) VALUES (?, ?, ?) ON CONFLICT(handle) DO UPDATE SET data = excluded.data").run(c.handle, pos, JSON.stringify(c));
  bump();
}
export function deleteCollection(handle: string) {
  open().prepare("DELETE FROM collections WHERE handle = ?").run(handle);
  bump();
}
export function reorderCollections(handles: string[]) {
  const st = open().prepare("UPDATE collections SET position = ? WHERE handle = ?");
  handles.forEach((h, i) => st.run(i, h));
  bump();
}

/* ───────────────────────── orders ───────────────────────── */

export interface OrderQuery {
  status?: OrderStatus | "all" | "open";
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function listOrders(query: OrderQuery = {}): { rows: Order[]; total: number } {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (query.status === "open") where.push("status IN ('pending','confirmed','packed','shipped')");
  else if (query.status && query.status !== "all") (where.push("status = ?"), args.push(query.status));
  if (query.from) (where.push("created_at >= ?"), args.push(query.from));
  if (query.to) (where.push("created_at < ?"), args.push(query.to));
  if (query.q) {
    where.push("(number LIKE ? OR phone LIKE ? OR data LIKE ?)");
    const like = `%${query.q}%`;
    args.push(like, like, like);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const db = open();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM orders ${w}`).get(...args) as { n: number }).n;
  const rows = (db.prepare(`SELECT data FROM orders ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, query.limit ?? 50, query.offset ?? 0) as { data: string }[]).map((r) => j<Order>(r.data));
  return { rows, total };
}
export function getOrder(idOrNumber: string): Order | null {
  const r = open().prepare("SELECT data FROM orders WHERE id = ? OR number = ?").get(idOrNumber, idOrNumber) as { data: string } | undefined;
  return r ? j<Order>(r.data) : null;
}
export function saveOrder(o: Order) {
  open()
    .prepare(
      "INSERT INTO orders (id, number, created_at, status, phone, total, demo, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, phone = excluded.phone, total = excluded.total, data = excluded.data",
    )
    .run(o.id, o.number, o.createdAt, o.status, o.customer.phone, Math.round(o.totals.total), o.demo ? 1 : 0, JSON.stringify(o));
  return o;
}
export function deleteOrder(id: string) {
  open().prepare("DELETE FROM orders WHERE id = ?").run(id);
}
export function clearDemoOrders() {
  const n = open().prepare("DELETE FROM orders WHERE demo = 1").run().changes;
  bump();
  return n;
}

/** Remove sample (demo) reviews added for client previews. */
export function clearDemoReviews() {
  const n = open().prepare("DELETE FROM reviews WHERE json_extract(data, '$.demo') = 1").run().changes;
  bump();
  return Number(n);
}

/** Real recent purchases for the storefront toast — first name, governorate and product only. */
/** Statuses that count as a real purchase for social proof: confirmed by the store and not cancelled or returned. */
const PURCHASED: OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"];

export function recentPurchases(hours = 48, limit = 8) {
  const since = new Date(Date.now() - hours * 36e5).toISOString();
  const rows = open()
    .prepare(`SELECT data FROM orders WHERE created_at >= ? AND status IN (${PURCHASED.map(() => "?").join(", ")}) AND demo = 0 ORDER BY created_at DESC LIMIT ?`)
    .all(since, ...PURCHASED, limit) as { data: string }[];
  return rows.map((r) => {
    const o = j<Order>(r.data);
    const l = o.lines[0];
    return { first: o.customer.name.trim().split(/\s+/)[0]?.slice(0, 20) ?? "", governorate: o.address.governorate, productId: l?.productId ?? "", at: o.createdAt };
  }).filter((x) => x.first && x.productId);
}

/** Did this phone number order this product (any non-cancelled order)? Used to mark reviews as verified. */
export function phoneBoughtProduct(phone: string, productId: string) {
  const rows = open().prepare("SELECT data FROM orders WHERE phone = ? AND status != 'cancelled'").all(phone) as { data: string }[];
  return rows.some((r) => j<Order>(r.data).lines.some((l) => l.productId === productId));
}

/** Lightweight numbers for the admin live poller. */
export function liveStats() {
  const db = open();
  const latest = db.prepare("SELECT number, created_at AS at, total, data FROM orders WHERE status != 'draft' ORDER BY created_at DESC LIMIT 1").get() as { number: string; at: string; total: number; data: string } | undefined;
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    latest: latest ? { number: latest.number, at: latest.at, total: latest.total, name: j<Order>(latest.data).customer.name } : null,
    pendingOrders: n("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
    unreadMessages: n("SELECT COUNT(*) AS n FROM messages WHERE read = 0"),
    pendingReviews: n("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'"),
  };
}
export function allOrders(): Order[] {
  return (open().prepare("SELECT data FROM orders ORDER BY created_at DESC").all() as { data: string }[]).map((r) => j<Order>(r.data));
}

export interface StockLine {
  productId: string;
  /** Variant colour — when omitted (legacy callers) the size's variants are drawn down best-stocked first */
  color?: string;
  size: string;
  qty: number;
}

function applyStock(lines: StockLine[], sign: 1 | -1) {
  const byProduct = new Map<string, StockLine[]>();
  for (const l of lines) if (l.qty > 0) byProduct.set(l.productId, [...(byProduct.get(l.productId) ?? []), l]);
  for (const [id, ls] of byProduct) {
    let p = getProduct(id);
    if (!p) continue;
    for (const l of ls) p = adjustStock(p, l.color, l.size, sign * Math.round(l.qty));
    saveProduct(p);
  }
}

/** Decrement stock for a placed order, per variant when `color` is given (never below zero), and refresh the storefront. */
export function decrementStock(lines: StockLine[]) {
  applyStock(lines, -1);
}

/** Put stock back (cancelled / returned orders), per variant when `color` is given. */
export function incrementStock(lines: StockLine[]) {
  applyStock(lines, 1);
}

/** Set one variant's stock to an absolute number. Returns false when the product/variant doesn't exist. */
export function setVariantStock(productId: string, color: string, size: string, stock: number): boolean {
  const p = getProduct(productId);
  if (!p) return false;
  const n = normalizeVariants(p);
  const v = n.variants!.find((x) => x.color === color && x.size === size);
  if (!v) return false;
  v.stock = Math.max(0, Math.min(1_000_000, Math.round(Number(stock) || 0)));
  saveProduct(n);
  return true;
}

/* ───────────────────────── reviews ───────────────────────── */

export function listReviews(): StoredReview[] {
  return (open().prepare("SELECT data FROM reviews ORDER BY created_at DESC").all() as { data: string }[]).map((r) => j<StoredReview>(r.data));
}
export function saveReview(r: StoredReview) {
  open()
    .prepare("INSERT INTO reviews (id, product_id, status, created_at, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, product_id = excluded.product_id, data = excluded.data")
    .run(r.id, r.productId, r.status, r.date, JSON.stringify(r));
  bump();
}
export function deleteReview(id: string) {
  open().prepare("DELETE FROM reviews WHERE id = ?").run(id);
  bump();
}

export function getReview(id: string): StoredReview | null {
  const r = open().prepare("SELECT data FROM reviews WHERE id = ?").get(id) as { data: string } | undefined;
  return r ? j<StoredReview>(r.data) : null;
}

/* ───────────────────────── review requests & settings ───────────────────────── */

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = { requestPrompt: false, reward: { enabled: false, kind: "pct", value: 10, photoRequired: false } };
export function getReviewSettings(): ReviewSettings {
  const s = kvGet<Partial<ReviewSettings>>("review-settings");
  return { ...DEFAULT_REVIEW_SETTINGS, ...s, reward: { ...DEFAULT_REVIEW_SETTINGS.reward, ...s?.reward } };
}
export function saveReviewSettings(next: ReviewSettings) {
  kvSet("review-settings", next);
}

export interface ReviewRequestRow {
  id: string;
  orderId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}
const reqRow = (r: Record<string, unknown> | undefined): ReviewRequestRow | null =>
  r ? { id: String(r.id), orderId: String(r.order_id), createdAt: String(r.created_at), expiresAt: String(r.expires_at), usedAt: (r.used_at as string | null) ?? null, revokedAt: (r.revoked_at as string | null) ?? null } : null;

/** Store a new personal review link (only the SHA-256 of the token is kept). Earlier unused links for the order are revoked. */
export function insertReviewRequest(row: { id: string; tokenHash: string; orderId: string; createdAt: string; expiresAt: string }) {
  const db = open();
  db.prepare("UPDATE review_requests SET revoked_at = ? WHERE order_id = ? AND used_at IS NULL AND revoked_at IS NULL").run(row.createdAt, row.orderId);
  db.prepare("INSERT INTO review_requests (id, token_hash, order_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(row.id, row.tokenHash, row.orderId, row.createdAt, row.expiresAt);
}
export function getReviewRequestByHash(tokenHash: string): ReviewRequestRow | null {
  return reqRow(open().prepare("SELECT * FROM review_requests WHERE token_hash = ?").get(tokenHash) as Record<string, unknown> | undefined);
}
export function markReviewRequestUsed(id: string) {
  return Number(open().prepare("UPDATE review_requests SET used_at = ? WHERE id = ? AND used_at IS NULL").run(now(), id).changes) > 0;
}
export function reviewRequestsForOrder(orderId: string): ReviewRequestRow[] {
  return (open().prepare("SELECT * FROM review_requests WHERE order_id = ? ORDER BY created_at DESC").all(orderId) as Record<string, unknown>[]).map((r) => reqRow(r)!);
}
export function deleteReviewRequestsForOrder(orderId: string) {
  return Number(open().prepare("DELETE FROM review_requests WHERE order_id = ?").run(orderId).changes);
}

/* ───────────────────────── messages (contact form) ───────────────────────── */

export interface ContactMessage {
  id: string;
  createdAt: string;
  name: string;
  phone?: string;
  email?: string;
  topic?: string;
  message: string;
  read: boolean;
}
export function addMessage(m: Omit<ContactMessage, "id" | "createdAt" | "read">): ContactMessage {
  const msg: ContactMessage = { ...m, id: `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, createdAt: now(), read: false };
  open().prepare("INSERT INTO messages (id, created_at, read, data) VALUES (?, ?, 0, ?)").run(msg.id, msg.createdAt, JSON.stringify(msg));
  return msg;
}
export function listMessages(): ContactMessage[] {
  return (open().prepare("SELECT read, data FROM messages ORDER BY created_at DESC").all() as { read: number; data: string }[]).map((r) => ({ ...j<ContactMessage>(r.data), read: !!r.read }));
}
export function setMessagesRead(ids: string[], read: boolean) {
  const st = open().prepare("UPDATE messages SET read = ? WHERE id = ?");
  let n = 0;
  for (const id of ids) n += Number(st.run(read ? 1 : 0, id).changes);
  return n;
}
export function deleteMessages(ids: string[]) {
  const st = open().prepare("DELETE FROM messages WHERE id = ?");
  let n = 0;
  for (const id of ids) n += Number(st.run(id).changes);
  return n;
}
export function unreadMessageCount() {
  return (open().prepare("SELECT COUNT(*) AS n FROM messages WHERE read = 0").get() as { n: number }).n;
}

/* ───────────────────────── media ───────────────────────── */

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
  size: number;
  createdAt: string;
}
export function listMedia(): MediaItem[] {
  return (open().prepare("SELECT data FROM media ORDER BY created_at DESC").all() as { data: string }[]).map((r) => j<MediaItem>(r.data));
}
export function saveMedia(m: MediaItem) {
  open().prepare("INSERT OR REPLACE INTO media (id, url, created_at, data) VALUES (?, ?, ?, ?)").run(m.id, m.url, m.createdAt, JSON.stringify(m));
}
export function deleteMedia(id: string) {
  open().prepare("DELETE FROM media WHERE id = ?").run(id);
}
export const MEDIA_DIR = path.join(path.dirname(DB_PATH), "uploads");

/* ───────────────────────── subscribers & activity ───────────────────────── */

export function addSubscriber(contact: string, source = "newsletter") {
  open().prepare("INSERT OR IGNORE INTO subscribers (contact, source, created_at) VALUES (?, ?, ?)").run(contact.trim(), source, now());
}
export function listSubscribers() {
  // node:sqlite rows have a null prototype — copy to plain objects so they can cross to client components
  return (open().prepare("SELECT id, contact, source, created_at AS createdAt FROM subscribers ORDER BY id DESC").all() as { id: number; contact: string; source: string; createdAt: string }[]).map((r) => ({ ...r }));
}

export function logActivity(action: string, target?: string, detail?: string, actor = "admin") {
  open().prepare("INSERT INTO activity (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)").run(now(), actor, action, target ?? null, detail ?? null);
}
export function listActivity(limit = 50) {
  return (open().prepare("SELECT id, at, actor, action, target, detail FROM activity ORDER BY id DESC LIMIT ?").all(limit) as { id: number; at: string; actor: string; action: string; target: string | null; detail: string | null }[]).map((r) => ({ ...r }));
}

/* ───────────────────────── backup ───────────────────────── */

export function exportAll() {
  return {
    exportedAt: now(),
    products: listProducts(),
    collections: listCollections(),
    settings: getSettings(),
    content: getContent(),
    reviews: listReviews(),
    orders: allOrders(),
    subscribers: listSubscribers(),
    messages: listMessages(),
  };
}

export function importAll(data: ReturnType<typeof exportAll>) {
  const db = open();
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM products; DELETE FROM collections; DELETE FROM reviews; DELETE FROM orders;");
    data.products.forEach((p, i) => db.prepare("INSERT INTO products (id, handle, status, position, data) VALUES (?, ?, ?, ?, ?)").run(p.id, p.handle, p.status ?? "active", i, JSON.stringify(p)));
    data.collections.forEach((c, i) => db.prepare("INSERT INTO collections (handle, position, data) VALUES (?, ?, ?)").run(c.handle, i, JSON.stringify(c)));
    data.reviews.forEach((r) => db.prepare("INSERT INTO reviews (id, product_id, status, created_at, data) VALUES (?, ?, ?, ?, ?)").run(r.id, r.productId, r.status, r.date, JSON.stringify(r)));
    data.orders.forEach((o) => saveOrder(o));
    kvSet("settings", data.settings);
    kvSet("content", data.content);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  bump();
}

/* ───────────────────────── seed & migrations ───────────────────────── */

/** First boot: catalog, collections, settings and content only — no fake orders or reviews. */
function seedIfEmpty(db: DatabaseSync) {
  const has = (db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
  if (has) return;
  // a fresh DB is opened by several processes at once (next build runs ~11 workers): take the write lock first, then
  // check again — another process may have seeded it while we waited (was "UNIQUE constraint failed: products.handle")
  db.exec("BEGIN IMMEDIATE");
  if ((db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n) {
    db.exec("COMMIT");
    return;
  }
  try {
    SEED_PRODUCTS.forEach((p, i) => db.prepare("INSERT INTO products (id, handle, status, position, data) VALUES (?, ?, ?, ?, ?)").run(p.id, p.handle, p.status ?? "active", i, JSON.stringify(p)));
    SEED_COLLECTIONS.forEach((c, i) => db.prepare("INSERT INTO collections (handle, position, data) VALUES (?, ?, ?)").run(c.handle, i, JSON.stringify(c)));
    db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('settings', ?)").run(JSON.stringify(SEED_SETTINGS));
    db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('content', ?)").run(JSON.stringify(seedContent(SEED_SETTINGS)));
    db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('migration:real-v1', ?)").run(JSON.stringify({ at: now(), fresh: true }));
    db.prepare("INSERT INTO activity (at, actor, action, target, detail) VALUES (?, 'system', 'Store created', 'VERDA', 'Seeded catalog and content')").run(now());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/**
 * One-time move to real variants: every product gets a colour × size grid, each size's
 * stock split across its colours (remainder to the first colours). Backs up first.
 * Idempotent (kv flag "migration:variants-v1").
 */
function migrateVariantsV1(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM kv WHERE key = 'migration:variants-v1'").get()) return;
  const rows = db.prepare("SELECT id, data FROM products").all() as { id: string; data: string }[];
  const todo = rows.map((r) => ({ id: r.id, p: j<Product>(r.data) })).filter((x) => !x.p.variants?.length);
  let backup: string | null = null;
  if (todo.length) {
    const dir = path.join(path.dirname(DB_PATH), "backups");
    fs.mkdirSync(dir, { recursive: true });
    backup = path.join(dir, `pre-variants-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backup, JSON.stringify(exportAll(), null, 2));
  }
  db.exec("BEGIN");
  try {
    const upd = db.prepare("UPDATE products SET data = ? WHERE id = ?");
    for (const { id, p } of todo) upd.run(JSON.stringify(normalizeVariants({ ...p, variants: variantsFromSizes(p) })), id);
    db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('migration:variants-v1', ?)").run(JSON.stringify({ at: now(), products: todo.length, backup }));
    if (todo.length) db.prepare("INSERT INTO activity (at, actor, action, target, detail) VALUES (?, 'system', 'Created product variants', ?, ?)").run(now(), `${todo.length} products`, backup ? `Backup: ${path.basename(backup)}` : null);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  bump();
}

/** Seed-generated review ids look like "p01-r3" (admin-written: "p01-m…", customer: "p01-u…"). */
const GENERATED_REVIEW = /^p\d+-r\d+$/;

/**
 * One-time cleanup for databases created before the store went real: back everything
 * up to data/backups/, then remove demo orders and seed-generated reviews. Idempotent
 * (guarded by the kv flag "migration:real-v1").
 */
function migrateRealV1(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM kv WHERE key = 'migration:real-v1'").get()) return;
  const fakeReviews = (db.prepare("SELECT id FROM reviews").all() as { id: string }[]).map((r) => r.id).filter((id) => GENERATED_REVIEW.test(id));
  const demoOrders = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE demo = 1").get() as { n: number }).n;
  let backup: string | null = null;
  if (fakeReviews.length || demoOrders) {
    const dir = path.join(path.dirname(DB_PATH), "backups");
    fs.mkdirSync(dir, { recursive: true });
    backup = path.join(dir, `pre-real-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backup, JSON.stringify(exportAll(), null, 2));
  }
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM orders WHERE demo = 1").run();
    // stored hand-typed social proof is meaningless now (it's computed) — zero it so backups don't carry it
    const upd = db.prepare("UPDATE products SET data = ? WHERE id = ?");
    for (const row of db.prepare("SELECT id, data FROM products").all() as { id: string; data: string }[]) upd.run(JSON.stringify({ ...j<Product>(row.data), rating: 0, reviewCount: 0, sold24h: 0 }), row.id);
    const del = db.prepare("DELETE FROM reviews WHERE id = ?");
    for (const id of fakeReviews) del.run(id);
    db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('migration:real-v1', ?)").run(JSON.stringify({ at: now(), demoOrders, fakeReviews: fakeReviews.length, backup }));
    if (fakeReviews.length || demoOrders)
      db.prepare("INSERT INTO activity (at, actor, action, target, detail) VALUES (?, 'system', 'Removed demo data', ?, ?)").run(now(), `${demoOrders} orders, ${fakeReviews.length} reviews`, backup ? `Backup: ${path.basename(backup)}` : null);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  bump();
}
