import "@/server/boot";
import { NextResponse } from "next/server";
import { recentPurchases } from "@/server/store";

export const dynamic = "force-dynamic";

/**
 * Public, sanitized feed for the storefront "recent purchase" toast: real orders from the
 * last 48 hours that the store has confirmed (not pending, cancelled, returned or demo) —
 * first name, governorate, product id and time. No phone, surname,
 * address or totals ever leave the server. Empty list when there are no recent orders.
 */
export function GET() {
  const items = recentPurchases(48, 8);
  return NextResponse.json({ items }, { headers: { "cache-control": "public, max-age=60, s-maxage=60" } });
}
