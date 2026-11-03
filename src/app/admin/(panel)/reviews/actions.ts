"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { waNumber } from "@/components/admin/sales/meta";
import { getT } from "@/lib/i18n/admin/server";
import type { FitTendency, StoredReview } from "@/lib/types";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { isReviewPhotoUrl, removeReviewPhoto } from "@/server/review-photos";
import { IMPORT_MAX_BYTES, rowToReview, validateImport, type ImportRow } from "@/server/review-import";
import { createReviewRequest, issueRewards, reviewRequestMessage, rewardMessage } from "@/server/review-requests";
import { deleteReview, getOrder, getProduct, getReview, getReviewSettings, getSettings, listProducts, listReviews, saveOrder, saveReview, saveReviewSettings, withTx } from "@/server/store";

type Status = StoredReview["status"];
const STATUSES: Status[] = ["published", "hidden", "pending"];
const ID = /^[A-Za-z0-9_-]{1,80}$/;
/** Real array of sane ids, capped at 500. */
const idList = (ids: unknown): string[] | null => (Array.isArray(ids) && ids.length <= 500 && ids.every((id) => typeof id === "string" && ID.test(id)) ? ids : null);

export async function setReviewsStatus(ids: string[], status: Status): Promise<ActionResult<{ updated: number; rewards: string[] }>> {
  await guard();
  const { t } = await getT();
  try {
    if (!STATUSES.includes(status)) return { ok: false, error: t("sales.errors.invalidStatus") };
    if (!idList(ids)) return { ok: false, error: t("sales.errors.invalidReviewSel") };
    const set = new Set(ids);
    const { updated, rewards } = withTx(() => {
      const changed: StoredReview[] = [];
      for (const r of listReviews()) {
        if (!set.has(r.id) || r.status === status) continue;
        const next = { ...r, status };
        saveReview(next);
        changed.push(next);
      }
      // publishing a qualifying review from a review link issues its single-use reward code
      const issued = status === "published" ? issueRewards(changed, saveReview) : new Map<string, string>();
      return { updated: changed.length, rewards: [...issued.values()] };
    });
    if (updated) published(`${status === "published" ? "Published" : status === "hidden" ? "Hid" : "Unpublished"} ${updated} review${updated === 1 ? "" : "s"}`, undefined, rewards.length ? `Reward code${rewards.length === 1 ? "" : "s"}: ${rewards.join(", ")}` : undefined);
    return { ok: true, data: { updated, rewards } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteReviews(ids: string[]): Promise<ActionResult> {
  await guard();
  try {
    if (!idList(ids)) return { ok: false, error: (await getT()).t("sales.errors.invalidReviewSel") };
    const photos: string[] = [];
    for (const id of ids) {
      photos.push(...(getReview(id)?.photos ?? []));
      deleteReview(id);
    }
    await Promise.all(photos.filter(isReviewPhotoUrl).map(removeReviewPhoto));
    published(`Deleted ${ids.length} review${ids.length === 1 ? "" : "s"}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveReviewReply(id: string, reply: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (typeof id !== "string" || typeof reply !== "string") return { ok: false, error: t("sales.errors.invalidReply") };
    const r = listReviews().find((x) => x.id === id);
    if (!r) return { ok: false, error: t("sales.errors.reviewNotFound") };
    const text = reply.trim().slice(0, 1000);
    saveReview({ ...r, reply: text || undefined });
    published(text ? "Replied to review" : "Removed review reply", r.author);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export interface NewReviewInput {
  productId: string;
  author: string;
  city: string;
  rating: number;
  title: string;
  body: string;
  size: string;
  date: string;
  verified: boolean;
  fit: FitTendency;
  height?: number;
  weight?: number;
  status: Status;
}

export async function createReview(input: NewReviewInput): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!input || typeof input !== "object") return { ok: false, error: t("sales.errors.invalidReview") };
    if (typeof input.productId !== "string" || !ID.test(input.productId)) return { ok: false, error: t("sales.errors.pickProduct") };
    const p = getProduct(input.productId);
    if (!p) return { ok: false, error: t("sales.errors.pickProduct") };
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const author = str(input.author, 60);
    const body = str(input.body, 2000);
    // size must be one of the product's real sizes
    const size = typeof input.size === "string" && p.sizes.some((s) => s.label === input.size) ? input.size : p.sizes[0]?.label || "M";
    if (!author) return { ok: false, error: t("sales.errors.authorRequired") };
    if (body.length < 3) return { ok: false, error: t("sales.errors.writeReview") };
    const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5)));
    const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : new Date().toISOString().slice(0, 10);
    const r: StoredReview = {
      id: `${p.id}-m${randomUUID().slice(0, 8)}`,
      productId: p.id,
      author,
      city: str(input.city, 60),
      rating,
      title: str(input.title, 120),
      body,
      date,
      verified: input.verified === true,
      size,
      height: Math.min(220, Math.max(120, Math.round(Number(input.height) || 170))),
      weight: Math.min(200, Math.max(35, Math.round(Number(input.weight) || 70))),
      fit: (["small", "true", "large"] as FitTendency[]).includes(input.fit) ? input.fit : "true",
      helpful: 0,
      status: STATUSES.includes(input.status) ? input.status : "published",
    };
    saveReview(r);
    published("Added review", p.title, `${rating}★ by ${author}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── review requests (personal WhatsApp links) ───────────── */

const ORDER_ID = /^[A-Za-z0-9_#-]{1,60}$/;

/** Store origin for links: the origin the merchant is using the admin on (same host as the storefront). */
async function storeOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  if (host && /^[A-Za-z0-9.:-]+$/.test(host)) return `${proto}://${host}`;
  return getSettings().site.url.replace(/\/$/, "");
}

/** Create a personal review link for a delivered order and return the wa.me URL with the prefilled message. */
export async function requestReview(orderId: string): Promise<ActionResult<{ href: string; link: string }>> {
  await guard();
  const { t } = await getT();
  try {
    if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) return { ok: false, error: t("reviews.errors.invalid") };
    const o = getOrder(orderId);
    if (!o) return { ok: false, error: t("sales.errors.orderNotFound") };
    if (o.status !== "delivered") return { ok: false, error: t("reviews.errors.notDelivered") };
    const { token, order } = createReviewRequest(o.id);
    const link = `${await storeOrigin()}${order.locale === "ar" ? "/ar" : ""}/review/${token}`;
    const text = reviewRequestMessage(order, link, getSettings().site.name);
    published("Review link created", order.number);
    return { ok: true, data: { href: `https://wa.me/${waNumber(order.customer.phone)}?text=${encodeURIComponent(text)}`, link } };
  } catch (e) {
    return fail(e);
  }
}

/** "Mark sent": the request went out (or the merchant handled it another way) — drops off the Review requests list. */
export async function markReviewRequestSent(orderId: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) return { ok: false, error: t("reviews.errors.invalid") };
    const number = withTx(() => {
      const o = getOrder(orderId);
      if (!o) throw new Error(t("sales.errors.orderNotFound"));
      o.reviewRequestSentAt = new Date().toISOString();
      saveOrder(o);
      return o.number;
    });
    published("Review request marked sent", number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveReviewRequestPrompt(enabled: boolean): Promise<ActionResult> {
  await guard();
  try {
    if (typeof enabled !== "boolean") return { ok: false, error: (await getT()).t("reviews.errors.invalid") };
    saveReviewSettings({ ...getReviewSettings(), requestPrompt: enabled });
    published(enabled ? "Turned on review prompt after delivery" : "Turned off review prompt after delivery");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** WhatsApp link that sends a review's reward code to the customer; stamps rewardSentAt. */
export async function sendReward(reviewId: string): Promise<ActionResult<{ href: string }>> {
  await guard();
  const { t } = await getT();
  try {
    if (typeof reviewId !== "string" || !ID.test(reviewId)) return { ok: false, error: t("sales.errors.invalidReviewSel") };
    const r = getReview(reviewId);
    if (!r?.rewardCode) return { ok: false, error: t("sales.errors.reviewNotFound") };
    const code = getSettings().promoCodes.find((p) => p.code === r.rewardCode);
    const order = r.orderId ? getOrder(r.orderId) : null;
    if (!code || !order) return { ok: false, error: t("sales.errors.reviewNotFound") };
    saveReview({ ...r, rewardSentAt: new Date().toISOString() });
    published("Sent review reward", code.code, order.number);
    return { ok: true, data: { href: `https://wa.me/${waNumber(order.customer.phone)}?text=${encodeURIComponent(rewardMessage(order, code, getSettings().site.name))}` } };
  } catch (e) {
    return fail(e);
  }
}

/** Remove one customer photo from a review (deletes the files too). */
export async function removeReviewPhotoAction(reviewId: string, url: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (typeof reviewId !== "string" || !ID.test(reviewId) || !isReviewPhotoUrl(url)) return { ok: false, error: t("reviews.errors.invalid") };
    const r = getReview(reviewId);
    if (!r) return { ok: false, error: t("sales.errors.reviewNotFound") };
    if (!r.photos?.includes(url)) return { ok: false, error: t("reviews.errors.invalid") };
    const photos = r.photos.filter((p) => p !== url);
    const { photos: _old, ...rest } = r;
    void _old;
    saveReview(photos.length ? { ...rest, photos } : rest);
    await removeReviewPhoto(url);
    published("Removed review photo", r.author);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────────── CSV import ───────────── */

export type ImportPreviewRow = Omit<ImportRow, "errors"> & { errors: string[] };

async function runValidation(csv: string) {
  const { t } = await getT();
  if (typeof csv !== "string") return { ok: false as const, error: t("reviews.errors.invalid") };
  if (csv.length > IMPORT_MAX_BYTES) return { ok: false as const, error: t("reviews.errors.tooBig") };
  const res = validateImport(csv, listProducts(), listReviews(), new Date().toISOString().slice(0, 10));
  if (!res.ok) return { ok: false as const, error: t(res.error.key, res.error.vars) };
  return { ok: true as const, rows: res.rows, t };
}

/** Validate a CSV and return every row with its (translated) errors — nothing is written. */
export async function previewReviewImport(csv: string): Promise<ActionResult<{ rows: ImportPreviewRow[] }>> {
  await guard();
  try {
    const v = await runValidation(csv);
    if (!v.ok) return v;
    return { ok: true, data: { rows: v.rows.map((r) => ({ ...r, errors: r.errors.map((e) => v.t(e.key, e.vars)) })) } };
  } catch (e) {
    return fail(e);
  }
}

/** Re-validate on the server and insert every valid row (rows with errors are skipped). */
export async function importReviews(csv: string, status: Status): Promise<ActionResult<{ imported: number; skipped: number }>> {
  await guard();
  try {
    if (status !== "published" && status !== "pending") return { ok: false, error: (await getT()).t("sales.errors.invalidStatus") };
    const v = await runValidation(csv);
    if (!v.ok) return v;
    const good = v.rows.filter((r) => !r.errors.length && r.productId);
    withTx(() => {
      for (const r of good) saveReview(rowToReview(r, status));
    });
    if (good.length) published(`Imported ${good.length} review${good.length === 1 ? "" : "s"}`, undefined, status === "published" ? "Published" : "Pending");
    return { ok: true, data: { imported: good.length, skipped: v.rows.length - good.length } };
  } catch (e) {
    return fail(e);
  }
}
