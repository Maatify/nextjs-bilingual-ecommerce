import "@/server/boot";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import type { FitTendency, StoredReview } from "@/lib/types";
import { checkReviewPhoto, displayName, photoErrorMessage, removeReviewPhoto, REVIEW_PHOTOS_PER_REVIEW, storeReviewPhoto } from "@/server/review-photos";
import { resolveReviewToken, reviewableLines } from "@/server/review-requests";
import { readFormBody } from "@/server/security/form-body";
import { clientIp, isBot, rateLimit, tooMany } from "@/server/security/rate-limit";
import { getProduct, getReviewSettings, logActivity, markReviewRequestUsed, saveReview, withTx } from "@/server/store";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 12;
/** Whole-request cap. 12 items × 3 photos × 8 MB (≈290 MB buffered in RAM per request) was an easy memory DoS. */
const MAX_BODY = 48 * 1024 * 1024;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const bad = (error: string, status = 400, field?: string) => NextResponse.json({ error, field }, { status });

interface ItemIn {
  key?: unknown;
  rating?: unknown;
  title?: unknown;
  body?: unknown;
  fit?: unknown;
}

/**
 * Submit every review from a personal review link (/review/<token>) at once. multipart/form-data:
 *   token, name, city, website (honeypot), items = JSON [{ key, rating, title, body, fit }], photos-<key> (≤3 files each)
 * `key` is the line's index in the order's reviewable lines. Reviews are saved PENDING and verified (the link proves
 * the purchase); the link is single-use.
 */
export async function POST(req: Request) {
  const L = msg(requestLocale(req));
  const ip = clientIp(req);
  const rl = rateLimit(`review-link:${ip}`, 8, 30 * 60_000);
  if (!rl.ok) return tooMany(rl, L("Too many tries — please wait a few minutes.", "جرّبت كذا مرة ورا بعض. استنى كام دقيقة وجرّب تاني."));
  const form = await readFormBody(req, MAX_BODY);
  if (!form.ok) return bad(form.status === 413 ? photoErrorMessage(L, "size") : form.error, form.status);
  const f = form.data;
  if (isBot(f.get("website"))) return NextResponse.json({ ok: true }, { status: 201 });

  const req0 = resolveReviewToken(f.get("token"));
  if (!req0.ok)
    return bad(
      req0.reason === "used" ? L("Reviews for this order were already sent — thank you!", "تقييمات الطلب ده وصلتنا خلاص، شكرًا ليك.") : req0.reason === "expired" ? L("This review link has expired.", "اللينك ده انتهى. تقدر تكتب تقييمك من صفحة المنتج.") : L("This review link isn't valid.", "اللينك ده مش شغال. افتحه كامل من رسالة الواتساب."),
      410,
    );
  const { order, requestId } = req0;
  const lines = reviewableLines(order);

  let items: ItemIn[];
  try {
    const raw = JSON.parse(String(f.get("items") ?? "[]")) as unknown;
    if (!Array.isArray(raw) || raw.length > MAX_ITEMS) throw new Error();
    items = raw.filter((x): x is ItemIn => !!x && typeof x === "object");
  } catch {
    return bad(L("Invalid request", "فيه حاجة غلط في البيانات. اعمل ريفرش للصفحة وجرّب تاني"));
  }
  const name = str(f.get("name"), 60) || order.customer.name;
  if (name.length < 2) return bad(L("Enter your name", "اكتب اسمك"), 400, "rl-name");
  const city = str(f.get("city"), 60);

  const seen = new Set<number>();
  const prepared: { line: (typeof lines)[number]; rating: number; title: string; body: string; fit: FitTendency | null; bufs: Buffer[] }[] = [];
  for (const it of items) {
    const key = Number(it.key);
    if (!Number.isInteger(key) || key < 0 || key >= lines.length || seen.has(key)) return bad(L("Invalid request", "فيه حاجة غلط في البيانات. اعمل ريفرش للصفحة وجرّب تاني"));
    seen.add(key);
    const rating = Number(it.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(L("Choose a star rating from 1 to 5", "دوس على النجوم واختار تقييمك"), 400, `rl-${key}-rating`);
    const body = typeof it.body === "string" ? it.body.trim().slice(0, 2000) : "";
    if (body.length < 10) return bad(L("Tell us a little more (10+ characters)", "اكتب تفاصيل أكتر شوية (10 حروف على الأقل)"), 400, `rl-${key}-body`);
    const fit = (["small", "true", "large"] as const).find((x) => x === it.fit) ?? null;
    const files = f.getAll(`photos-${key}`).filter((x): x is File => typeof x === "object" && x.size > 0);
    if (files.length > REVIEW_PHOTOS_PER_REVIEW) return bad(photoErrorMessage(L, "count"), 400, `rl-${key}-photos`);
    const bufs: Buffer[] = [];
    for (const file of files) {
      const c = await checkReviewPhoto(file);
      if (!c.ok) return bad(photoErrorMessage(L, c.error), 400, `rl-${key}-photos`);
      bufs.push(c.buf);
    }
    prepared.push({ line: lines[key], rating, title: str(it.title, 120), body, fit, bufs });
  }
  if (!prepared.length) return bad(L("Rate at least one item", "قيّم قطعة واحدة على الأقل"));

  // encode photos first (async), then write everything + burn the link in one transaction
  const stored: string[][] = [];
  try {
    for (const p of prepared) {
      const urls: string[] = [];
      for (const buf of p.bufs) urls.push(await storeReviewPhoto(buf));
      stored.push(urls);
    }
  } catch {
    await Promise.all(stored.flat().map(removeReviewPhoto));
    return bad(photoErrorMessage(L, "decode"));
  }
  const incentivized = getReviewSettings().reward.enabled;
  const today = new Date().toISOString().slice(0, 10);
  const author = displayName(name);
  const ok = withTx(() => {
    if (!markReviewRequestUsed(requestId)) return false;
    prepared.forEach((p, i) => {
      const product = getProduct(p.line.productId);
      const review: StoredReview = {
        id: `${p.line.productId}-u${randomUUID().slice(0, 8)}`,
        productId: p.line.productId,
        author,
        city,
        rating: p.rating,
        title: p.title,
        body: p.body,
        date: today,
        verified: true,
        size: product?.sizes.some((s) => s.label === p.line.size) ? p.line.size : "",
        height: 0,
        weight: 0,
        fit: p.fit ?? "true",
        ...(p.fit ? {} : { fitUnknown: true }),
        ...(stored[i].length ? { photos: stored[i] } : {}),
        ...(incentivized ? { incentivized: true } : {}),
        helpful: 0,
        status: "pending",
        orderId: order.id,
        requestId,
      };
      saveReview(review);
    });
    logActivity("Reviews submitted from review link", order.number, `${prepared.length} review${prepared.length === 1 ? "" : "s"} by ${author}`, "customer");
    return true;
  });
  if (!ok) {
    await Promise.all(stored.flat().map(removeReviewPhoto));
    return bad(L("Reviews for this order were already sent — thank you!", "تقييمات الطلب ده وصلتنا خلاص، شكرًا ليك."), 410);
  }
  return NextResponse.json({ ok: true, count: prepared.length }, { status: 201 });
}
