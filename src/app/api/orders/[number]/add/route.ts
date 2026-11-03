import "@/server/boot";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getProductById, variantPrice, variantStock } from "@/lib/catalog";
import { normalizeEgPhone } from "@/lib/egypt";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import { colorName, localizeProduct } from "@/lib/i18n/store/content";
import type { OrderLine } from "@/lib/types";
import { clientIp, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";
import { decrementStock, getOrder, logActivity, saveOrder } from "@/server/store";

export const dynamic = "force-dynamic";

/** Post-purchase "add to this order" offer: 20% off one extra piece, ships in the same parcel. */
const UPSELL_DISCOUNT = 0.2;
const WINDOW_MS = 30 * 60_000;
const MAX_ADDS = 3;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * POST /api/orders/VD-123456/add  { phone, productId, color, size }
 * Only for the customer who placed the order (phone must match), only while it's still
 * pending and within 30 minutes of placing it. Re-priced here; totals, stock and timeline updated.
 */
export async function POST(req: Request, ctx: { params: Promise<{ number: string }> }) {
  const locale = requestLocale(req);
  const L = msg(locale);
  const rl = rateLimit(`order-add:${clientIp(req)}`, 10, 10 * 60_000);
  if (!rl.ok) return tooMany(rl);
  const parsed = await readJsonBody<{ phone?: unknown; productId?: unknown; color?: unknown; size?: unknown }>(req, 2_048);
  if (!parsed.ok) return bad(parsed.error, parsed.status);
  const b = parsed.data;

  const number = decodeURIComponent((await ctx.params).number).toUpperCase().slice(0, 40);
  const phone = normalizeEgPhone(str(b.phone, 30));
  const order = /^VD-\d+$/.test(number) ? getOrder(number) : null;
  // same answer for unknown order and wrong phone so numbers can't be probed
  if (!order || !phone || normalizeEgPhone(order.customer.phone) !== phone) return bad(L("We couldn't find that order", "ملقيناش الطلب ده، راجع رقم الطلب والموبايل"), 404);
  if (order.status !== "pending") return bad(L("This order is already being prepared — message us on WhatsApp to add items.", "طلبك دخل التجهيز خلاص. لو عايز تضيف حاجة ابعتلنا واتساب."), 409);
  if (Date.now() - new Date(order.createdAt).getTime() > WINDOW_MS) return bad(L("Items can only be added within 30 minutes of ordering.", "الإضافة متاحة أول 30 دقيقة بس بعد الطلب. لو عايز حاجة ابعتلنا واتساب."), 409);
  const added = order.lines.filter((l) => l.title.endsWith("(added)"));
  if (added.length >= MAX_ADDS) return bad(L("You've already added the maximum to this order.", "ضفت أقصى عدد قطع ينفع يتضاف للطلب ده. اعمل طلب جديد للباقي."), 409);

  const p = getProductById(str(b.productId, 40));
  if (!p) return bad(L("That product isn't available", "القطعة دي مش متاحة دلوقتي"));
  if (order.lines.some((l) => l.productId === p.id)) return bad(L("That product is already in your order", "القطعة دي موجودة في طلبك أصلًا"), 409);
  const color = p.colors.find((c) => c.name === str(b.color, 60)) ?? p.colors[0];
  const size = p.sizes.find((s) => s.label === str(b.size, 20));
  if (!color || !size) return bad(L("Choose a size", "اختار المقاس الأول"));
  if (variantStock(p, color.name, size.label) < 1) return bad(L(`${p.title} in ${color.name} / ${size.label} just sold out`, `${localizeProduct(p, "ar").title} (${colorName(p, color.name, "ar")} / ${size.label}) خلص من شوية`), 409);

  const price = Math.round(variantPrice(p, color.name, size.label).price * (1 - UPSELL_DISCOUNT));
  const line: OrderLine = { productId: p.id, handle: p.handle, title: `${p.title} (added)`, color: color.name, size: size.label, qty: 1, unit: price, image: color.images[0], total: price, free: 0 };
  const at = new Date().toISOString();
  order.lines.push(line);
  order.totals = { ...order.totals, itemCount: order.totals.itemCount + 1, subtotal: order.totals.subtotal + price, total: order.totals.total + price };
  order.timeline.push({ status: "note", at, note: `Customer added ${p.title} (${color.name} / ${size.label}) after checkout — EGP ${price.toLocaleString("en-US")}`, by: "customer" });
  saveOrder(order);
  decrementStock([{ productId: p.id, color: color.name, size: size.label, qty: 1 }]);
  logActivity("Item added to order", order.number, `${p.title} · EGP ${price.toLocaleString("en-US")}`, "customer");
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, line, totals: order.totals }, { status: 200 });
}
