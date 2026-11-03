import "@/server/boot";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getProductById, variantStock } from "@/lib/catalog";
import { enabledPayments, getBump, PAYMENT_METHODS, priceCheckout, type PaymentMethod } from "@/lib/checkout";
import { normalizeEgPhone } from "@/lib/egypt";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import { colorName, localizeProduct } from "@/lib/i18n/store/content";
import type { Locale } from "@/lib/i18n/store/config";
import type { CartLine, Order, OrderLine } from "@/lib/types";
import { findIdempotentOrder, isIdempotencyKey, rememberIdempotentOrder } from "@/server/security/idempotency";
import { clientIp, isBot, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";
import { decrementStock, getOrder, getSettings, logActivity, saveOrder, saveSettings } from "@/server/store";

export const dynamic = "force-dynamic";

interface Body {
  lines?: { productId?: unknown; color?: unknown; size?: unknown; qty?: unknown }[];
  customer?: { name?: unknown; phone?: unknown; email?: unknown; whatsappUpdates?: unknown };
  address?: { governorate?: unknown; city?: unknown; street?: unknown; building?: unknown; landmark?: unknown; notes?: unknown };
  shipping?: unknown;
  payment?: unknown;
  promoCode?: unknown;
  protection?: unknown;
  bump?: unknown;
  source?: unknown;
  /** storefront language the order was placed in ("en" | "ar") */
  locale?: unknown;
  /** honeypot — real shoppers never fill it */
  website?: unknown;
}

const MAX_BODY = 32 * 1024;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string, field?: string, status = 400) => NextResponse.json({ error, field }, { status });

function newOrderNumber() {
  for (let i = 0; i < 20; i++) {
    const number = `VD-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!getOrder(number)) return number;
  }
  return `VD-${Date.now().toString().slice(-8)}`;
}

/** Place an order. Everything is re-validated and re-priced here — client totals are never trusted. */
export async function POST(req: Request) {
  // error messages follow the shopper's language; the stored order data stays English (the admin reads English)
  let locale: Locale = requestLocale(req);
  const L = (en: string, ar: string) => msg(locale)(en, ar);
  const ip = clientIp(req);
  // Generous enough for shoppers behind carrier-grade NAT; stops scripted order floods.
  const rl = rateLimit(`orders:${ip}`, 20, 10 * 60_000);
  if (!rl.ok) return tooMany(rl, L("Too many orders from your network — please wait a few minutes and try again.", "اتعمل طلبات كتير من نفس الشبكة. استنى كام دقيقة ودوس تأكيد تاني."));

  const key = req.headers.get("idempotency-key");
  if (key !== null && !isIdempotencyKey(key)) return bad("Invalid Idempotency-Key");

  const parsed = await readJsonBody<Body>(req, MAX_BODY);
  if (!parsed.ok) return bad(parsed.error, undefined, parsed.status);
  const body = parsed.data;
  if (body.locale === "ar" || body.locale === "en") locale = body.locale;
  // Honeypot filled → pretend it worked (bots get no signal to adapt) and store nothing. There's deliberately no
  // `order` in the body, so a real shopper whose autofill somehow filled the hidden field sees the normal
  // "couldn't place order" message instead of a fake thank-you; the drop is logged so the owner can follow up.
  if (isBot(body.website)) {
    logActivity("Order dropped (spam honeypot)", str(isObj(body.customer) ? body.customer.phone : "", 30) || undefined, undefined, "customer");
    return NextResponse.json({ number: newOrderNumber() }, { status: 201 });
  }
  if ((body.customer !== undefined && !isObj(body.customer)) || (body.address !== undefined && !isObj(body.address))) return bad("Invalid request");

  // Same key within 10 minutes (double-click, retry after a dropped connection) → the first order, not a new one.
  // Everything from here to saveOrder() is synchronous, so two concurrent requests can't both pass this check.
  if (key) {
    const prev = findIdempotentOrder(key);
    if (prev) return NextResponse.json({ number: prev.number, order: prev }, { status: 200, headers: { "Idempotent-Replayed": "true" } });
  }

  // ── customer & address
  const name = str(body.customer?.name, 120);
  const phone = normalizeEgPhone(str(body.customer?.phone, 30));
  const email = str(body.customer?.email, 160) || undefined;
  if (name.split(/\s+/).filter(Boolean).length < 2) return bad(L("Enter your first and last name", "اكتب اسمك الأول واسم العيلة"), "name");
  if (!phone) return bad(L("Enter a valid Egyptian mobile number", "الرقم لازم يكون 11 رقم ويبدأ بـ 01"), "phone");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return bad(L("Enter a valid email", "الإيميل ده مش مكتوب صح، راجعه"), "email");

  const priced0 = priceCheckout({ cart: [], governorate: str(body.address?.governorate), shipping: "standard", payment: "cod" });
  if (!priced0.gov) return bad(L("Choose a governorate we deliver to", "اختار المحافظة من القائمة، دي المحافظات اللي بنوصّلها"), "governorate");
  const address: Order["address"] = {
    governorate: priced0.gov.name,
    city: str(body.address?.city, 120),
    street: str(body.address?.street, 200),
    building: str(body.address?.building, 160),
    landmark: str(body.address?.landmark, 160) || undefined,
    notes: str(body.address?.notes, 500) || undefined,
  };
  if (address.city.length < 2) return bad(L("Enter your city or area", "اكتب المدينة أو المنطقة"), "city");
  const source: Order["source"] = body.source === "lp" ? "lp" : "web";
  if (address.street.length < 2) return bad(L("Enter your street address", "اكتب اسم الشارع ورقمه"), "street");
  // the landing-page form collects street + building in one field
  if (!address.building && source !== "lp") return bad(L("Enter building, floor and apartment", "اكتب العمارة والدور والشقة"), "building");

  // ── payment / shipping
  const payment = str(body.payment) as PaymentMethod;
  if (!PAYMENT_METHODS.includes(payment) || !enabledPayments().includes(payment)) return bad(L("That payment method isn't available", "طريقة الدفع دي مش متاحة دلوقتي، اختار طريقة تانية"), "payment");
  const shipping = body.shipping === "express" ? "express" : "standard";

  // ── lines: products, colours, sizes and stock
  if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 50) return bad(L("Your bag is empty", "شنطتك فاضية، ضيف قطعة الأول"));
  const need = new Map<string, number>(); // productId|colour|size -> qty (stock is per variant)
  const cart: CartLine[] = [];
  for (const raw of body.lines) {
    if (!isObj(raw)) return bad("Invalid request");
    const productId = str(raw.productId, 40);
    const qty = Math.floor(Number(raw.qty));
    const p = getProductById(productId);
    if (!p) return bad(L("A product in your bag is no longer available", "فيه قطعة في شنطتك مبقتش متاحة، شيلها وكمّل الطلب"));
    const shown = localizeProduct(p, locale).title;
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) return bad(L(`Invalid quantity for ${p.title}`, `الكمية من ${shown} لازم تكون من 1 لـ 20`));
    const color = p.colors.find((c) => c.name === str(raw.color, 60));
    if (!color) return bad(L(`${p.title}: colour not available`, `${shown}: اللون ده مش متاح، اختار لون تاني`));
    const size = p.sizes.find((s) => s.label === str(raw.size, 20));
    if (!size) return bad(L(`${p.title}: size not available`, `${shown}: المقاس ده مش متاح، اختار مقاس تاني`));
    const k = `${p.id}|${color.name}|${size.label}`;
    need.set(k, (need.get(k) ?? 0) + qty);
    cart.push({ key: `${p.id}-${color.name}-${size.label}`, productId: p.id, color: color.name, size: size.label, qty });
  }

  // checkout offer: first colour/size with stock (prefers M), after what the bag already needs
  const bumpOffer = body.bump ? getBump() : null;
  let bumpPick: { color: string; size: string } | undefined;
  if (bumpOffer) {
    const bp = bumpOffer.product;
    const free = (c: string, s: string) => variantStock(bp, c, s) - (need.get(`${bp.id}|${c}|${s}`) ?? 0);
    const sizes = [...bp.sizes].sort((a, b) => (b.label === "M" ? 1 : 0) - (a.label === "M" ? 1 : 0));
    outer: for (const s of sizes)
      for (const c of bp.colors)
        if (free(c.name, s.label) > 0) {
          bumpPick = { color: c.name, size: s.label };
          break outer;
        }
    if (bumpPick) need.set(`${bp.id}|${bumpPick.color}|${bumpPick.size}`, (need.get(`${bp.id}|${bumpPick.color}|${bumpPick.size}`) ?? 0) + 1);
  }

  for (const [k, qty] of need) {
    const [id, color, label] = k.split("|");
    const p = getProductById(id)!;
    const stock = variantStock(p, color, label);
    const what = p.colors.length > 1 ? `${p.title} (${color} / ${label})` : `${p.title} in ${label}`;
    const whatAr = p.colors.length > 1 ? `${localizeProduct(p, "ar").title} (${colorName(p, color, "ar")} / ${label})` : `${localizeProduct(p, "ar").title} مقاس ${label}`;
    if (stock < qty) return bad(stock ? L(`Only ${stock} left of ${what}`, `فاضل ${stock} بس من ${whatAr}، قلّل الكمية`) : L(`${what} just sold out`, `${whatAr} خلص من شوية، شيله من الشنطة وكمّل`), "stock", 409);
  }

  // ── price on the server
  const rawPromo = str(body.promoCode, 40).toUpperCase();
  const promo = /^[A-Z0-9_-]{1,40}$/.test(rawPromo) ? rawPromo : null;
  const { totals, express, bump } = priceCheckout({
    cart,
    governorate: address.governorate,
    shipping,
    payment,
    promo,
    protection: body.protection === true,
    bump: !!bumpOffer && !!bumpPick,
  });
  if (!totals.itemCount) return bad(L("Your bag is empty", "شنطتك فاضية، ضيف قطعة الأول"));

  const lines: OrderLine[] = totals.lines.map((l) => ({
    productId: l.productId,
    handle: l.product.handle,
    title: l.product.title,
    color: l.color,
    size: l.size,
    qty: l.qty,
    unit: l.unit,
    image: (l.product.colors.find((c) => c.name === l.color) ?? l.product.colors[0]).images[0],
    total: l.total,
    free: l.freeUnits,
  }));
  if (bump && bumpPick) {
    const bc = bump.product.colors.find((c) => c.name === bumpPick.color) ?? bump.product.colors[0];
    lines.push({
      productId: bump.product.id,
      handle: bump.product.handle,
      title: `${bump.product.title} (checkout offer)`,
      color: bc.name,
      size: bumpPick.size,
      qty: 1,
      unit: bump.price,
      image: bc.images[0],
      total: bump.price,
      free: 0,
    });
  }

  const at = new Date().toISOString();
  const number = newOrderNumber();
  // `locale` is an extra field on the stored JSON (shopper's storefront language); everything else stays English
  const order: Order & { locale: Locale } = {
    id: `o_${number}`,
    number,
    createdAt: at,
    status: "pending",
    paymentStatus: "unpaid",
    paymentMethod: payment,
    source,
    customer: { name, phone, email, whatsappUpdates: body.customer?.whatsappUpdates !== false },
    address,
    shipping: express ? "express" : "standard",
    lines,
    totals: {
      itemCount: totals.itemCount + (bump ? 1 : 0),
      subtotal: totals.subtotal,
      bogoDiscount: totals.bogoDiscount,
      multiDiscount: totals.multiDiscount,
      promoDiscount: totals.promoDiscount,
      prepaidDiscount: totals.prepaidDiscount,
      shipping: totals.shipping,
      protection: totals.protection,
      bump: totals.bump,
      total: totals.total,
    },
    promoCode: totals.promoDiscount ? totals.promoCode : undefined,
    timeline: [{ status: "pending", at, by: "customer" }],
    locale,
  };

  saveOrder(order);
  if (key) rememberIdempotentOrder(key, number);
  decrementStock(lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })));

  if (order.promoCode) {
    const settings = getSettings();
    saveSettings({
      ...settings,
      promoCodes: settings.promoCodes.map((c) => (c.code.toUpperCase() === order.promoCode ? { ...c, used: (c.used ?? 0) + 1 } : c)),
    });
  }

  logActivity("Order placed", number, `EGP ${order.totals.total.toLocaleString("en-US")}`, "customer");
  revalidatePath("/", "layout");

  return NextResponse.json({ number, order }, { status: 201 });
}
