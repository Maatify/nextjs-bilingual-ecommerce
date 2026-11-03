import "@/server/boot";
import { NextResponse } from "next/server";
import { normalizeEgPhone } from "@/lib/egypt";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import { clientIp, isBot, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";
import { addSubscriber, logActivity } from "@/server/store";

export const dynamic = "force-dynamic";

/** POST { contact, source, website? } — newsletter / welcome-popup sign-ups (email or Egyptian mobile). `website` is a honeypot. */
export async function POST(req: Request) {
  const rl = rateLimit(`subscribe:${clientIp(req)}`, 6, 10 * 60_000);
  if (!rl.ok) return tooMany(rl);
  const parsed = await readJsonBody<{ contact?: unknown; source?: unknown; website?: unknown }>(req, 2048);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  if (isBot(body.website)) return NextResponse.json({ ok: true }); // pretend success, store nothing
  const raw = typeof body.contact === "string" ? body.contact.trim().slice(0, 160) : "";
  const email = /^[^\s@<>"']{1,64}@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(raw) ? raw.toLowerCase() : null;
  const contact = email ?? normalizeEgPhone(raw);
  if (!contact) return NextResponse.json({ error: msg(requestLocale(req))("Enter a valid email or mobile number", "اكتب إيميل صحيح أو رقم موبايل يبدأ بـ 01") }, { status: 400 });
  const source = typeof body.source === "string" && /^[\w-]{1,40}$/.test(body.source) ? body.source : "newsletter";
  addSubscriber(contact, source);
  logActivity("New subscriber", contact, source, "customer");
  return NextResponse.json({ ok: true });
}
