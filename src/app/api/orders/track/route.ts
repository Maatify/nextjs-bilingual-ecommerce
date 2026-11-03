import "@/server/boot";
import { NextResponse } from "next/server";
import { normalizeEgPhone } from "@/lib/egypt";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import { clientIp, rateLimit, tooMany } from "@/server/security/rate-limit";
import { getOrder } from "@/server/store";

export const dynamic = "force-dynamic";

/** GET /api/orders/track?number=VD-123456&phone=010… → status + timeline when the phone matches. */
export function GET(req: Request) {
  const L = msg(requestLocale(req));
  // stops enumeration of number + phone pairs
  const rl = rateLimit(`track:${clientIp(req)}`, 30, 10 * 60_000);
  if (!rl.ok) return tooMany(rl);
  const sp = new URL(req.url).searchParams;
  const raw = (sp.get("number") ?? "").slice(0, 40).trim().toUpperCase().replace(/\s+/g, "");
  const number = /^VD-?\d+$/.test(raw) ? raw.replace(/^VD-?/, "VD-") : raw;
  const phone = normalizeEgPhone(sp.get("phone") ?? "");
  if (!number || !phone) return NextResponse.json({ error: L("Enter your order number and mobile", "اكتب رقم الطلب ورقم الموبايل") }, { status: 400 });

  const order = getOrder(number);
  // Same response for "not found" and "phone mismatch" so order numbers can't be probed.
  if (!order || normalizeEgPhone(order.customer.phone) !== phone) {
    return NextResponse.json({ error: L("We couldn't find an order with that number and mobile", "ملقيناش طلب بالرقم ده. راجع رقم الطلب والموبايل، أو ابعتلنا واتساب") }, { status: 404 });
  }

  return NextResponse.json({
    number: order.number,
    status: order.status,
    createdAt: order.createdAt,
    shipping: order.shipping,
    governorate: order.address.governorate,
    itemCount: order.totals.itemCount,
    total: order.totals.total,
    timeline: order.timeline.filter((t) => t.status !== "note").map(({ status, at }) => ({ status, at })),
  });
}
