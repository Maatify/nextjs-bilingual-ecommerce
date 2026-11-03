import "@/server/boot";
import { NextResponse } from "next/server";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import { clientIp, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";
import { getSettings } from "@/server/store";

export const dynamic = "force-dynamic";

/**
 * Unlock a personal promo code (e.g. a review reward). Those codes are kept out of the public snapshot, so the
 * checkout asks here by exact code. Rate limited per IP so codes can't be enumerated.
 */
export async function POST(req: Request) {
  const L = msg(requestLocale(req));
  const rl = rateLimit(`promo:${clientIp(req)}`, 12, 10 * 60_000);
  if (!rl.ok) return tooMany(rl, L("Too many tries — please wait a few minutes.", "جرّبت كذا مرة ورا بعض. استنى كام دقيقة وجرّب تاني."));
  const parsed = await readJsonBody<{ code?: unknown }>(req, 1_024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const key = typeof parsed.data.code === "string" ? parsed.data.code.trim().toUpperCase().slice(0, 32) : "";
  const nowIso = new Date().toISOString();
  const c = key ? getSettings().promoCodes.find((p) => p.private && p.code.toUpperCase() === key) : undefined;
  const live = c && c.active && (!c.startsAt || c.startsAt <= nowIso) && (!c.endsAt || c.endsAt >= nowIso) && (!c.usageLimit || (c.used ?? 0) < c.usageLimit);
  if (!c || !live) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { code, label, pct, amount, minSubtotal, active, usageLimit, used, startsAt, endsAt } = c;
  return NextResponse.json({ code: { code, label, pct, amount, minSubtotal, active, usageLimit, used, startsAt, endsAt, private: true } }, { headers: { "cache-control": "no-store" } });
}
