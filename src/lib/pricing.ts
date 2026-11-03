import { getProductById, variantPrice } from "./catalog";
import { getOffer, getPromoCodes } from "./site";
import type { CartLine, Locale, PromoCode, Product } from "./types";

export interface PricedLine extends CartLine {
  product: Product;
  unit: number;
  compareUnit: number;
  /** How many units of this line are free via Buy 2 Get 1 */
  freeUnits: number;
  /** EGP taken off this line by the multi-buy % offer (e.g. 2 pieces → 20% off) */
  multiOff: number;
  total: number;
}

export interface Totals {
  lines: PricedLine[];
  itemCount: number;
  subtotal: number;
  /** Savings vs compare-at prices (already reflected in subtotal) */
  compareSavings: number;
  bogoDiscount: number;
  /** Multi-buy % discount (e.g. 20% off 2 pieces) */
  multiDiscount: number;
  promoDiscount: number;
  prepaidDiscount: number;
  shipping: number;
  protection: number;
  bump: number;
  total: number;
  totalSavings: number;
  freeShipping: boolean;
  gift: boolean;
  /** Items needed to unlock the next free item via Buy N Get M (0 when the offer is off) */
  toNextFree: number;
  /** Whether the Buy N Get M offer is currently enabled */
  bogoEnabled: boolean;
  /** Promo code actually applied (after validation), if any */
  promoCode?: string;
  /** Why the requested promo code was not applied, if it wasn't */
  promoError?: string;
}

export interface CheckoutOptions {
  promo?: string | null;
  payment?: "cod" | "card" | "wallet" | "installments";
  shippingRate?: number;
  protection?: boolean;
  bump?: number;
}

/** Buy N Get M group size, or 0 when the offer is disabled. */
export function bogoGroup() {
  const o = getOffer();
  return o.bogoEnabled && o.bogo.buy > 0 && o.bogo.get > 0 ? o.bogo.buy + o.bogo.get : 0;
}

/** Live multi-buy offer ({qty, pct}) or null when off. Defaults to 2 pieces → 20% when not configured yet. */
export function multiBuy() {
  const m = getOffer().multiBuy ?? { enabled: true, qty: 2, pct: 20 };
  return m.enabled && m.qty > 1 && m.pct > 0 ? { qty: m.qty, pct: Math.min(90, m.pct) } : null;
}

/** "20% OFF" / "خصم 20%" */
export function multiBuyBadge(locale: Locale = "en") {
  const m = multiBuy();
  if (!m) return "";
  return locale === "ar" ? `خصم ${m.pct}%` : `${m.pct}% OFF`;
}

/** "Buy 2, get 20% off" / "اشتري 2 وخد خصم 20%" */
export function multiBuyLabel(locale: Locale = "en") {
  const m = multiBuy();
  if (!m) return "";
  return locale === "ar" ? `اشتري ${m.qty} وخد خصم ${m.pct}%` : `Buy ${m.qty}, get ${m.pct}% off`;
}

/** Validate a promo code against the live settings for a given merchandise subtotal. */
export function checkPromo(raw: string | null | undefined, merch: number, locale: Locale = "en"): { code?: PromoCode; error?: string } {
  if (!raw) return {};
  const key = raw.trim().toUpperCase();
  const code = getPromoCodes()[key];
  const ar = locale === "ar";
  if (!code) return { error: ar ? `الكود \u2066${key}\u2069 مش شغال، اتأكد إنه مكتوب صح` : `“${key}” isn't a valid code` };
  if (code.minSubtotal && merch < code.minSubtotal)
    return { code, error: ar ? `الكود \u2066${key}\u2069 بيشتغل على الطلبات من ${code.minSubtotal.toLocaleString("en-US")} ج.م، ضيف قطع كمان وجرّبه تاني` : `${key} needs a subtotal of EGP ${code.minSubtotal.toLocaleString("en-US")}+` };
  return { code };
}

export function priceLines(cart: CartLine[]): PricedLine[] {
  const lines: PricedLine[] = [];
  for (const l of cart) {
    const product = getProductById(l.productId);
    if (!product) continue;
    // variant price overrides (colour × size) win over the product price
    const vp = variantPrice(product, l.color, l.size);
    lines.push({ ...l, product, unit: vp.price, compareUnit: vp.compareAt ?? vp.price, freeUnits: 0, multiOff: 0, total: vp.price * l.qty });
  }
  // Buy N Get M: expand units, the cheapest M of every N+M group are free.
  const group = bogoGroup();
  const units = lines.flatMap((l, i) => Array.from({ length: l.qty }, () => ({ i, price: l.unit })));
  const freeCount = group ? Math.floor(units.length / group) * getOffer().bogo.get : 0;
  units.sort((a, b) => a.price - b.price);
  for (let k = 0; k < freeCount; k++) lines[units[k].i].freeUnits++;
  // Multi-buy: pieces left over after full Buy-N-Get-M groups get the % off when there are enough of them
  // (2 pieces → 20% off both; 3 → third free; 5 → 3-for-2 + 20% off the other 2).
  const mb = multiBuy();
  const leftover = group ? units.length % group : units.length;
  if (mb && leftover >= mb.qty) {
    const paid = units.slice(freeCount); // ascending price, free ones excluded
    for (const u of paid.slice(0, leftover)) lines[u.i].multiOff += Math.round((u.price * mb.pct) / 100);
  }
  for (const l of lines) l.total = l.unit * (l.qty - l.freeUnits) - l.multiOff;
  return lines;
}

export function computeTotals(cart: CartLine[], opts: CheckoutOptions = {}): Totals {
  const OFFER = getOffer();
  const lines = priceLines(cart);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const gross = lines.reduce((n, l) => n + l.unit * l.qty, 0);
  const compareSavings = lines.reduce((n, l) => n + (l.compareUnit - l.unit) * l.qty, 0);
  const bogoDiscount = lines.reduce((n, l) => n + l.unit * l.freeUnits, 0);
  const multiDiscount = lines.reduce((n, l) => n + l.multiOff, 0);
  const subtotal = gross;
  const afterBogo = gross - bogoDiscount - multiDiscount;

  const promoCheck = checkPromo(opts.promo, afterBogo);
  const code = promoCheck.error ? undefined : promoCheck.code;
  const promoDiscount = code ? Math.min(afterBogo, code.pct ? Math.round((afterBogo * code.pct) / 100) : code.amount ?? 0) : 0;

  const merch = afterBogo - promoDiscount;
  const freeShipping = merch >= OFFER.freeShippingAt;
  const shipping = itemCount === 0 ? 0 : freeShipping ? 0 : opts.shippingRate ?? OFFER.shipping;
  const prepaid = opts.payment && opts.payment !== "cod" && opts.payment !== "installments";
  const prepaidDiscount = prepaid ? Math.round((merch * OFFER.prepaidDiscountPct) / 100) : 0;
  const protection = opts.protection && itemCount ? OFFER.protection : 0;
  const bump = opts.bump ?? 0;
  const total = Math.max(0, merch - prepaidDiscount + shipping + protection + bump);

  const group = bogoGroup();
  const toNextFree = !group ? 0 : itemCount === 0 ? group : group - (itemCount % group || group) || group;

  return {
    lines,
    itemCount,
    subtotal,
    compareSavings,
    bogoDiscount,
    multiDiscount,
    promoDiscount,
    prepaidDiscount,
    shipping,
    protection,
    bump,
    total,
    totalSavings: compareSavings + bogoDiscount + multiDiscount + promoDiscount + prepaidDiscount + (freeShipping && itemCount ? OFFER.shipping : 0),
    freeShipping,
    gift: merch >= OFFER.giftAt,
    toNextFree,
    bogoEnabled: group > 0,
    promoCode: code?.code.toUpperCase(),
    promoError: promoCheck.error,
  };
}

export interface BundleTier {
  qty: number;
  label: string;
  note: string;
  total: number;
  save: number;
  popular?: boolean;
  /** offer chip, e.g. "20% OFF" */
  badge?: string;
}

/** Bundle tiers shown on the product page ("quantity breaks"). */
export function bundleTiers(price: number, locale: Locale = "en"): BundleTier[] {
  const OFFER = getOffer();
  const ar = locale === "ar";
  const T = ar
    ? { one: "قطعة واحدة", two: "قطعتين", three: "3 قطع", std: "السعر العادي", ship: "شحن مجاني", mix: "غيّر في الألوان براحتك", stock: "خد احتياطك", free: (n: number) => (n === 1 ? "قطعة ببلاش" : `${n} ${n > 10 ? "قطعة" : "قطع"} ببلاش`), most: "الأكتر طلبًا" }
    : { one: "1 piece", two: "2 pieces", three: "3 pieces", std: "Standard price", ship: "Free shipping unlocked", mix: "Mix any colours", stock: "Stock up", free: (n: number) => (n === 1 ? "1 piece free" : `${n} pieces free`), most: "most chosen" };
  const ship = (n: number) => (price * n >= OFFER.freeShippingAt ? OFFER.shipping : 0);
  const group = bogoGroup();
  const mb = multiBuy();
  // the 2-piece tier: % off when the multi-buy offer is on
  const two = (note: string): BundleTier => {
    if (!mb || mb.qty !== 2) return { qty: 2, label: T.two, note, total: price * 2, save: ship(2) };
    const total = Math.round(price * 2 * (1 - mb.pct / 100));
    return { qty: 2, label: T.two, note: multiBuyLabel(locale), badge: multiBuyBadge(locale), total, save: price * 2 - total + (total >= OFFER.freeShippingAt ? OFFER.shipping : 0) };
  };
  if (!group) {
    return [
      { qty: 1, label: T.one, note: T.std, total: price, save: 0 },
      { ...two(ship(2) ? T.ship : T.mix), popular: true },
      { qty: 3, label: T.three, note: ship(3) ? T.ship : T.stock, total: price * 3, save: ship(3) },
    ];
  }
  const { buy, get } = OFFER.bogo;
  const paid = buy;
  return [
    { qty: 1, label: T.one, note: T.std, total: price, save: 0 },
    ...(group > 2 ? [two(ship(2) ? T.ship : T.mix)] : []),
    { qty: group, label: bogoLabel(locale), note: `${T.free(get)} · ${T.most}`, total: price * paid, save: price * get + ship(paid), popular: true },
  ];
}

/** "Buy 2, Get 1 Free" / "اشتري 2 والتالتة ببلاش" — from the live offer settings (empty string when off). */
export function bogoLabel(locale: Locale = "en") {
  if (!bogoGroup()) return "";
  const { buy, get } = getOffer().bogo;
  if (locale === "ar") {
    if (get === 1 && buy === 2) return "اشتري 2 والتالتة ببلاش";
    if (get === 1 && buy === 1) return "اشتري 1 والتانية ببلاش";
    return `اشتري ${buy} وخد ${get} ببلاش`;
  }
  return `Buy ${buy}, Get ${get} Free`;
}

export const installment = (total: number, months = 6) => Math.ceil(total / months);
