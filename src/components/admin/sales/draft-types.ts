import type { OfferSettings, Order } from "@/lib/types";

/* Shared (client + server) shapes for the "Create order" / draft-order editor. */

export type DiscountKind = "none" | "code" | "amount" | "pct";

export interface DraftLineInput {
  productId: string;
  color: string;
  size: string;
  qty: number;
}

export interface DraftInput {
  lines: DraftLineInput[];
  customer: { name: string; phone: string; email?: string };
  address: { governorate: string; city: string; street: string; building: string; landmark?: string };
  shippingFee: number;
  discount: { kind: DiscountKind; value?: number; code?: string };
  notes: string;
  paymentMethod: Order["paymentMethod"];
}

export interface PickerProduct {
  id: string;
  title: string;
  status: string;
  price: number;
  colors: { name: string; hex: string; image: string }[];
  sizes: string[];
  /** stock[color][size] — real variant stock (or per-size stock for legacy products) */
  stock: Record<string, Record<string, number>>;
  /** unit price per colour|size when a variant overrides the price */
  prices: Record<string, number>;
  tracked: boolean;
}

export interface PickerCustomer {
  name: string;
  phone: string;
  email?: string;
  orders: number;
  address: DraftInput["address"];
}

/** Automatic storefront offers that also apply to manual (draft) orders. */
export interface OfferRules {
  bogo: { buy: number; get: number } | null;
  multi: { qty: number; pct: number } | null;
}
export function offerRules(o: Pick<OfferSettings, "bogoEnabled" | "bogo" | "multiBuy">): OfferRules {
  const m = o.multiBuy ?? { enabled: true, qty: 2, pct: 20 };
  return {
    bogo: o.bogoEnabled && o.bogo.buy > 0 && o.bogo.get > 0 ? { buy: o.bogo.buy, get: o.bogo.get } : null,
    multi: m.enabled && m.qty > 1 && m.pct > 0 ? { qty: m.qty, pct: Math.min(90, m.pct) } : null,
  };
}

/**
 * Buy-N-Get-M + multi-buy % for a list of priced lines — the same rules as priceLines() in src/lib/pricing.ts
 * (keep in sync). Drafts can't call computeTotals directly: it prices from the storefront snapshot, which only
 * holds ACTIVE products, while a manual order may contain draft/archived ones. Per line: free units + EGP off.
 */
export function applyOffers(lines: { unit: number; qty: number }[], r: OfferRules) {
  const free = lines.map(() => 0);
  const off = lines.map(() => 0);
  const group = r.bogo ? r.bogo.buy + r.bogo.get : 0;
  const units = lines.flatMap((l, i) => Array.from({ length: Math.max(0, l.qty) }, () => ({ i, price: l.unit })));
  const freeCount = r.bogo && group ? Math.floor(units.length / group) * r.bogo.get : 0;
  units.sort((a, b) => a.price - b.price);
  for (let k = 0; k < freeCount; k++) free[units[k].i]++;
  const leftover = group ? units.length % group : units.length;
  if (r.multi && leftover >= r.multi.qty) for (const u of units.slice(freeCount).slice(0, leftover)) off[u.i] += Math.round((u.price * r.multi.pct) / 100);
  return {
    free,
    off,
    bogo: lines.reduce((n, l, i) => n + l.unit * free[i], 0),
    multi: off.reduce((n, x) => n + x, 0),
  };
}

/** Totals for a manual order: subtotal (gross) − automatic offers − manual discount (on what's left) + shipping. */
export const draftTotals = (lines: { unit: number; qty: number }[], discount: number, shipping: number, offers: { bogo: number; multi: number } = { bogo: 0, multi: 0 }) => {
  const subtotal = lines.reduce((n, l) => n + l.unit * l.qty, 0);
  const merch = Math.max(0, subtotal - offers.bogo - offers.multi);
  const d = Math.min(merch, Math.max(0, Math.round(discount)));
  const ship = Math.max(0, Math.round(shipping));
  return { subtotal, bogo: offers.bogo, multi: offers.multi, merch, discount: d, shipping: ship, total: Math.max(0, merch - d + ship) };
};

/** Discount amount for a subtotal (code → settings promo code). */
/** `error` is a code — translate with t(`sales.draft.codeErr.${error}`, { min: egp(min) }). */
export function discountAmount(d: DraftInput["discount"], subtotal: number, codes: { code: string; pct?: number; amount?: number; minSubtotal?: number; active: boolean }[]): { amount: number; error?: "unknown" | "paused" | "min"; min?: number; code?: string } {
  if (d.kind === "amount") return { amount: Math.min(subtotal, Math.max(0, Number(d.value) || 0)) };
  if (d.kind === "pct") return { amount: Math.round((subtotal * Math.min(100, Math.max(0, Number(d.value) || 0))) / 100) };
  if (d.kind === "code") {
    const c = codes.find((x) => x.code.toUpperCase() === (d.code ?? "").trim().toUpperCase());
    if (!c) return { amount: 0, error: "unknown" };
    if (!c.active) return { amount: 0, error: "paused" };
    if (c.minSubtotal && subtotal < c.minSubtotal) return { amount: 0, error: "min", min: c.minSubtotal };
    return { amount: Math.min(subtotal, c.pct ? Math.round((subtotal * c.pct) / 100) : (c.amount ?? 0)), code: c.code.toUpperCase() };
  }
  return { amount: 0 };
}
