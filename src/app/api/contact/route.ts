import "@/server/boot";
import { NextResponse } from "next/server";
import { normalizeEgPhone } from "@/lib/egypt";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import { clientIp, isBot, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";
import { addMessage, logActivity } from "@/server/store";

export const dynamic = "force-dynamic";

const TOPICS = ["order", "exchange", "product", "other"] as const;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string, field?: string, status = 400) => NextResponse.json({ error, field }, { status });

/** Contact form → `messages` table → Admin → Messages inbox. */
export async function POST(req: Request) {
  const L = msg(requestLocale(req));
  const rl = rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return tooMany(rl, L("You've sent a few messages already — please wait a few minutes or WhatsApp us.", "بعتلنا كذا رسالة ورا بعض. استنى كام دقيقة وابعت تاني، أو كلّمنا واتساب على طول."));
  const parsed = await readJsonBody<{ name?: unknown; phone?: unknown; email?: unknown; topic?: unknown; message?: unknown; website?: unknown }>(req, 8_192);
  if (!parsed.ok) return bad(parsed.error, undefined, parsed.status);
  const b = parsed.data;
  if (isBot(b.website)) return NextResponse.json({ ok: true }, { status: 201 });

  const name = str(b.name, 80).replace(/\s+/g, " ");
  if (name.length < 2) return bad(L("Enter your name", "اكتب اسمك"), "name");
  const rawPhone = str(b.phone, 30);
  const phone = rawPhone ? normalizeEgPhone(rawPhone) : null;
  if (rawPhone && !phone) return bad(L("Enter a valid Egyptian mobile number", "الرقم لازم يكون 11 رقم ويبدأ بـ 01"), "phone");
  const email = str(b.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(L("Enter a valid email", "الإيميل ده مش مكتوب صح، راجعه"), "email");
  if (!phone && !email) return bad(L("Add a mobile number or email so we can reply", "سيب رقم موبايل أو إيميل عشان نعرف نرد عليك"), "phone");
  const message = str(b.message, 4000);
  if (message.length < 10) return bad(L("Tell us a little more (10+ characters)", "اكتب تفاصيل أكتر شوية (10 حروف على الأقل)"), "message");
  const topic = TOPICS.find((t) => t === b.topic) ?? "other";

  const m = addMessage({ name, phone: phone ?? undefined, email: email || undefined, topic, message });
  logActivity("Message received", name, topic, "customer");
  return NextResponse.json({ ok: true, id: m.id }, { status: 201 });
}
