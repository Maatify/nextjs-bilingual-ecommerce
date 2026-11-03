import "@/server/boot";
import { NextResponse } from "next/server";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import { CHECKOUT_ID, checkoutLines } from "@/server/queries/checkouts";
import { clientIp, rateLimit, tooMany } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

/** Cart-restore link (/cart?restore=<id>): returns only the bag lines — never name, phone or address. */
export async function GET(req: Request, { params }: RouteContext<"/api/checkouts/[id]">) {
  const rl = rateLimit(`checkout-restore:${clientIp(req)}`, 30, 10 * 60_000);
  if (!rl.ok) return tooMany(rl);
  const { id } = await params;
  const lines = CHECKOUT_ID.test(id) ? checkoutLines(id) : null;
  if (!lines) return NextResponse.json({ error: msg(requestLocale(req))("This cart link has expired.", "لينك الشنطة ده انتهى. ضيف القطع تاني من الموقع.") }, { status: 404, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ lines }, { headers: { "cache-control": "no-store" } });
}
