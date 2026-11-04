import type { CheckoutSession, Order } from "@/lib/types";
import { getDb, getProduct } from "@/server/store";
import { variantPrice } from "@/lib/variants";

/*
 * Abandoned checkouts (Shopify-style recovery). A row is written by the storefront
 * checkout beacon (POST /api/checkouts) once a shopper has typed a valid phone or
 * email with something in the bag. "Recovered" is computed on read: an order with the
 * same phone (or email) placed after the checkout started.
 */

type G = typeof globalThis & { __vedraCheckoutsReady?: boolean };
const g = globalThis as G;

function db() {
  const d = getDb();
  if (!g.__vedraCheckoutsReady) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS checkouts (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, phone TEXT, email TEXT, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS checkouts_updated ON checkouts(updated_at);
    `);
    g.__vedraCheckoutsReady = true;
  }
  return d;
}

export const CHECKOUT_ID = /^[A-Za-z0-9-]{16,64}$/;
const digits = (p?: string) => (p ?? "").replace(/\D/g, "").replace(/^20/, "0");

export interface CheckoutInput {
  id: string;
  customer: { name?: string; phone?: string; email?: string };
  governorate?: string;
  lines: { productId: string; color: string; size: string; qty: number }[];
}

/**
 * Create or update a checkout. Lines are re-priced from the catalog (never trusted).
 * Returns null when nothing usable is left (no known products).
 */
export function upsertCheckout(input: CheckoutInput): CheckoutSession | null {
  const lines: CheckoutSession["lines"] = [];
  for (const l of input.lines) {
    const p = getProduct(l.productId);
    if (!p || (p.status ?? "active") !== "active") continue;
    const color = p.colors.find((c) => c.name === l.color) ?? p.colors[0];
    if (!color || !p.sizes.some((s) => s.label === l.size)) continue;
    lines.push({ productId: p.id, title: p.title, color: color.name, size: l.size, qty: l.qty, unit: variantPrice(p, color.name, l.size).price, image: color.images[0] ?? "" });
  }
  if (!lines.length) return null;
  const d = db();
  const now = new Date().toISOString();
  const base = getCheckoutRaw(input.id);
  // already turned into an order — keep it as the record of that recovery (the client starts a new id after ordering)
  if (base && recoveredBy(base)) return base;
  const s: CheckoutSession = {
    id: input.id,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    customer: { ...base?.customer, ...Object.fromEntries(Object.entries(input.customer).filter(([, v]) => v)) },
    governorate: input.governorate || base?.governorate,
    lines,
    total: lines.reduce((n, l) => n + l.unit * l.qty, 0),
    remindedAt: base?.remindedAt,
  };
  d.prepare(
    "INSERT INTO checkouts (id, created_at, updated_at, phone, email, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, phone = excluded.phone, email = excluded.email, data = excluded.data",
  ).run(s.id, s.createdAt, s.updatedAt, digits(s.customer.phone) || null, s.customer.email?.toLowerCase() || null, JSON.stringify(s));
  return s;
}

function getCheckoutRaw(id: string): CheckoutSession | null {
  const r = db().prepare("SELECT data FROM checkouts WHERE id = ?").get(id) as { data: string } | undefined;
  return r ? (JSON.parse(r.data) as CheckoutSession) : null;
}

/** The order (if any) that recovered this checkout: same phone/email, placed after it started. */
function recoveredBy(s: CheckoutSession): string | undefined {
  const phone = digits(s.customer.phone);
  const email = s.customer.email?.toLowerCase();
  if (!phone && !email) return undefined;
  const rows = db().prepare("SELECT number, phone, data FROM orders WHERE created_at >= ? AND status != 'draft' ORDER BY created_at ASC LIMIT 200").all(s.createdAt) as { number: string; phone: string; data: string }[];
  for (const r of rows) {
    if (phone && digits(r.phone) === phone) return r.number;
    if (email && (JSON.parse(r.data) as Order).customer.email?.toLowerCase() === email) return r.number;
  }
  return undefined;
}

const withRecovery = (s: CheckoutSession): CheckoutSession => ({ ...s, recoveredOrder: recoveredBy(s) });

export function getCheckout(id: string): CheckoutSession | null {
  const s = getCheckoutRaw(id);
  return s ? withRecovery(s) : null;
}

export function listCheckouts(limit = 500): CheckoutSession[] {
  const rows = db().prepare("SELECT data FROM checkouts ORDER BY updated_at DESC LIMIT ?").all(limit) as { data: string }[];
  return rows.map((r) => withRecovery(JSON.parse(r.data) as CheckoutSession));
}

/** Public, PII-free view used by the storefront cart restore link. */
export function checkoutLines(id: string) {
  const s = getCheckoutRaw(id);
  return s ? s.lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })) : null;
}

export function markReminded(id: string) {
  const s = getCheckoutRaw(id);
  if (!s) return null;
  s.remindedAt = new Date().toISOString();
  db().prepare("UPDATE checkouts SET data = ? WHERE id = ?").run(JSON.stringify(s), id);
  return s;
}

export function deleteCheckouts(ids: string[]) {
  const st = db().prepare("DELETE FROM checkouts WHERE id = ?");
  let n = 0;
  for (const id of ids) n += Number(st.run(id).changes);
  return n;
}

/** Abandoned (not recovered) checkouts started since local midnight — sidebar badge. */
export function abandonedTodayCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = db().prepare("SELECT data FROM checkouts WHERE created_at >= ?").all(today.toISOString()) as { data: string }[];
  return rows.filter((r) => !recoveredBy(JSON.parse(r.data) as CheckoutSession)).length;
}
