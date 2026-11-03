import "@/server/boot";
import { NextResponse } from "next/server";
import { normalizeEgPhone } from "@/lib/egypt";
import { CHECKOUT_ID, upsertCheckout } from "@/server/queries/checkouts";
import { clientIp, isBot, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

interface Body {
  id?: unknown;
  customer?: { name?: unknown; phone?: unknown; email?: unknown };
  governorate?: unknown;
  lines?: unknown;
  website?: unknown;
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ok = (id?: string) => NextResponse.json({ ok: true, id }, { headers: { "cache-control": "no-store" } });

/**
 * Abandoned-checkout beacon from the storefront checkout form (debounced, fetch keepalive / sendBeacon).
 * Stored only when there is a valid phone OR email and at least one cart line.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`checkouts:${clientIp(req)}`, 60, 10 * 60_000);
  if (!rl.ok) return tooMany(rl);
  // sendBeacon posts text/plain — accept it, the body is still JSON
  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  const parsed = await readJsonBody<Body>(new Request(req.url, { method: "POST", headers, body: req.body, duplex: "half" } as RequestInit), 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const b = parsed.data;
  if (isBot(b.website)) return ok();

  const id = str(b.id, 64);
  if (!CHECKOUT_ID.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const c = b.customer && typeof b.customer === "object" && !Array.isArray(b.customer) ? b.customer : {};
  const phone = normalizeEgPhone(str(c.phone, 30)) ?? undefined;
  const emailRaw = str(c.email, 160).toLowerCase();
  const email = EMAIL.test(emailRaw) ? emailRaw : undefined;
  if (!phone && !email) return ok();

  if (!Array.isArray(b.lines) || !b.lines.length) return ok();
  const lines = b.lines.slice(0, 50).flatMap((l) => {
    if (!l || typeof l !== "object") return [];
    const r = l as Record<string, unknown>;
    const qty = Math.floor(Number(r.qty));
    const productId = str(r.productId, 40);
    if (!productId || !Number.isFinite(qty) || qty < 1 || qty > 20) return [];
    return [{ productId, color: str(r.color, 60), size: str(r.size, 20), qty }];
  });
  if (!lines.length) return ok();

  const s = upsertCheckout({ id, customer: { name: str(c.name, 120) || undefined, phone, email }, governorate: str(b.governorate, 60) || undefined, lines });
  return ok(s?.id);
}
