import "@/server/boot";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeEgPhone } from "@/lib/egypt";
import { msg, requestLocale } from "@/lib/i18n/store/api";
import type { FitTendency, StoredReview } from "@/lib/types";
import { checkReviewPhoto, displayName, photoErrorMessage, REVIEW_PHOTOS_PER_REVIEW, storeReviewPhoto } from "@/server/review-photos";
import { readFormBody } from "@/server/security/form-body";
import { clientIp, isBot, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";
import { getProduct, logActivity, phoneBoughtProduct, saveReview } from "@/server/store";

export const dynamic = "force-dynamic";

interface Body {
  productId?: unknown;
  rating?: unknown;
  title?: unknown;
  body?: unknown;
  name?: unknown;
  city?: unknown;
  size?: unknown;
  fit?: unknown;
  phone?: unknown;
  website?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Customer review submission. Saved as "pending" — nothing reaches the storefront until an
 * admin publishes it in Admin → Reviews. Verified only when the phone matches an order for this product.
 */
export async function POST(req: Request) {
  const L = msg(requestLocale(req));
  const rl = rateLimit(`reviews:${clientIp(req)}`, 4, 30 * 60_000);
  if (!rl.ok) return tooMany(rl, L("You've sent a few reviews already — please try again later.", "بعتّ كذا تقييم ورا بعض. جرّب تاني بعد شوية."));
  // JSON (text only) or multipart (text + up to 3 photos)
  let b: Body;
  let files: File[] = [];
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const form = await readFormBody(req, REVIEW_PHOTOS_PER_REVIEW * 8 * 1024 * 1024 + 64_000);
    if (!form.ok) return bad(form.status === 413 ? photoErrorMessage(L, "size") : form.error, form.status);
    b = Object.fromEntries([...form.data.entries()].filter(([, v]) => typeof v === "string")) as Body;
    files = form.data.getAll("photos").filter((f): f is File => typeof f === "object" && f.size > 0);
  } else {
    const parsed = await readJsonBody<Body>(req, 8_192);
    if (!parsed.ok) return bad(parsed.error, parsed.status);
    b = parsed.data;
  }
  if (isBot(b.website)) return NextResponse.json({ ok: true }, { status: 201 });
  if (files.length > REVIEW_PHOTOS_PER_REVIEW) return bad(photoErrorMessage(L, "count"));

  const product = getProduct(str(b.productId, 40));
  if (!product || (product.status ?? "active") !== "active") return bad(L("This product isn't available", "القطعة دي مش متاحة دلوقتي"));
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(L("Choose a star rating from 1 to 5", "دوس على النجوم واختار تقييمك"));
  const text = typeof b.body === "string" ? b.body.trim().slice(0, 2000) : "";
  if (text.length < 10) return bad(L("Tell us a little more (10+ characters)", "اكتب تفاصيل أكتر شوية (10 حروف على الأقل)"));
  const name = str(b.name, 60);
  if (name.length < 2) return bad(L("Enter your name", "اكتب اسمك"));
  const rawPhone = str(b.phone, 30);
  const phone = rawPhone ? normalizeEgPhone(rawPhone) : null;
  if (rawPhone && !phone) return bad(L("Enter a valid Egyptian mobile number, or leave it empty", "الرقم لازم يكون 11 رقم ويبدأ بـ 01، أو سيب الخانة فاضية"));
  const size = product.sizes.some((s) => s.label === str(b.size, 20)) ? str(b.size, 20) : "";
  const fit: FitTendency = (["small", "true", "large"] as const).find((f) => f === b.fit) ?? "true";
  const bufs: Buffer[] = [];
  for (const f of files) {
    const c = await checkReviewPhoto(f);
    if (!c.ok) return bad(photoErrorMessage(L, c.error));
    bufs.push(c.buf);
  }
  const photos: string[] = [];
  for (const buf of bufs) photos.push(await storeReviewPhoto(buf));

  const review: StoredReview = {
    id: `${product.id}-u${randomUUID().slice(0, 8)}`,
    productId: product.id,
    author: displayName(name),
    city: str(b.city, 60),
    rating,
    title: str(b.title, 120),
    body: text,
    date: new Date().toISOString().slice(0, 10),
    verified: phone ? phoneBoughtProduct(phone, product.id) : false,
    size,
    height: 0,
    weight: 0,
    fit,
    ...(photos.length ? { photos } : {}),
    helpful: 0,
    status: "pending",
  };
  saveReview(review);
  logActivity("Review submitted", product.title, `${rating}★ by ${review.author}${review.verified ? " (verified buyer)" : ""}${photos.length ? ` · ${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""}`, "customer");
  return NextResponse.json({ ok: true }, { status: 201 });
}
