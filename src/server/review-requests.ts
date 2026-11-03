import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Order, PromoCode, StoredReview } from "@/lib/types";
import { getOrder, getReviewRequestByHash, getReviewSettings, getSettings, insertReviewRequest, listReviews, saveOrder, saveSettings, withTx } from "./store";

/*
 * Personal review links: /review/<token>. The token is 128 random bits (base64url); only its SHA-256 is stored,
 * so a database leak can't be turned into working links. Links expire after 60 days and stop working once used.
 */

export const REVIEW_LINK_DAYS = 60;
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Create a fresh link for an order (revokes earlier unused links) and stamp `reviewRequestedAt`. */
export function createReviewRequest(orderId: string): { token: string; order: Order } {
  return withTx(() => {
    const order = getOrder(orderId);
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status !== "delivered") throw new Error("NOT_DELIVERED");
    const token = randomBytes(16).toString("base64url");
    const at = new Date();
    insertReviewRequest({ id: `rr_${randomUUID().slice(0, 12)}`, tokenHash: hashToken(token), orderId: order.id, createdAt: at.toISOString(), expiresAt: new Date(at.getTime() + REVIEW_LINK_DAYS * 864e5).toISOString() });
    order.reviewRequestedAt = at.toISOString();
    saveOrder(order);
    return { token, order };
  });
}

export type ResolvedRequest =
  | { ok: true; requestId: string; order: Order; expiresAt: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Look a token up (constant-shape answer — never reveals whether an order exists). */
export function resolveReviewToken(token: unknown): ResolvedRequest {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, reason: "invalid" };
  const row = getReviewRequestByHash(hashToken(token));
  if (!row || row.revokedAt) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt < new Date().toISOString()) return { ok: false, reason: "expired" };
  const order = getOrder(row.orderId);
  if (!order || order.status !== "delivered") return { ok: false, reason: "invalid" };
  return { ok: true, requestId: row.id, order, expiresAt: row.expiresAt };
}

/** Distinct reviewable lines of an order (one per product + colour + size). */
export function reviewableLines(order: Order) {
  const seen = new Set<string>();
  return order.lines.filter((l) => {
    const k = `${l.productId}|${l.color}|${l.size}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The WhatsApp message (customer's storefront language), with the one personal link. */
export function reviewRequestMessage(order: Order, link: string, storeName: string) {
  const s = getReviewSettings();
  const first = order.customer.name.trim().split(/\s+/)[0] ?? "";
  const reward = s.reward.enabled ? (s.reward.kind === "pct" ? `${s.reward.value}%` : `EGP ${s.reward.value}`) : "";
  if (order.locale === "ar") {
    return [
      `أهلًا يا ${first}`,
      `طلبك من ${storeName} (#${order.number}) وصلك، ويارب يكون عجبك.`,
      `ممكن تقولنا رأيك؟ مش هياخد غير دقيقة، وبيفرق مع اللي بيحتار في المقاس.`,
      reward ? `وأول ما تقييمك يتنشر هنبعتلك كود خصم ${reward} على طلبك الجاي${s.reward.photoRequired ? " (لو ضفت صورة)" : ""}.` : "",
      link,
      `شكرًا ليك 💚`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Hi ${first} 👋`,
    `Your ${storeName} order (#${order.number}) has arrived — we hope you love it!`,
    `Could you tell us what you think? It takes a minute and really helps other shoppers.`,
    reward ? `Once your review is published we'll send you ${reward} off your next order${s.reward.photoRequired ? " (reviews with a photo)" : ""} 🎁` : "",
    link,
    `Thank you 💚`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Message that delivers a reward code. */
export function rewardMessage(order: Order | null, code: PromoCode, storeName: string) {
  const first = order?.customer.name.trim().split(/\s+/)[0] ?? "";
  const off = code.pct ? `${code.pct}%` : `EGP ${code.amount}`;
  const until = code.endsAt ? code.endsAt.slice(0, 10) : "";
  if (order?.locale === "ar")
    return `أهلًا يا ${first}، تقييمك نزل على ${storeName}، شكرًا ليك 💚\nودي هديتك، كود خصم ${off} على طلبك الجاي: ${code.code}\n(ينفع مرة واحدة${until ? ` لحد ${until}` : ""})`;
  return `Hi ${first}, thank you for your review — it's now live on ${storeName} 💚\nHere's ${off} off your next order: ${code.code}\n(single use${until ? `, valid until ${until}` : ""})`;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function rewardCode(taken: Set<string>) {
  for (;;) {
    const bytes = randomBytes(8);
    let tail = "";
    for (const b of bytes) tail += CODE_CHARS[b % CODE_CHARS.length];
    const code = `THANKS-${tail}`;
    if (!taken.has(code)) return code;
  }
}

/**
 * Called when reviews become published: every incentivized review from a review link that qualifies (photo when
 * required) earns ONE single-use private promo code per review link. Returns the codes issued, by review id.
 */
export function issueRewards(reviews: StoredReview[], save: (r: StoredReview) => void): Map<string, string> {
  const issued = new Map<string, string>();
  const s = getReviewSettings();
  if (!s.reward.enabled || !(s.reward.value > 0)) return issued;
  const all = listReviews();
  const rewardedRequests = new Set(all.filter((r) => r.rewardCode && r.requestId).map((r) => r.requestId!));
  const settings = getSettings();
  const taken = new Set(settings.promoCodes.map((p) => p.code));
  const codes: PromoCode[] = [];
  for (const r of reviews) {
    if (r.status !== "published" || !r.incentivized || !r.requestId || r.rewardCode || rewardedRequests.has(r.requestId)) continue;
    if (s.reward.photoRequired && !r.photos?.length) continue;
    const code = rewardCode(taken);
    taken.add(code);
    rewardedRequests.add(r.requestId);
    const order = r.orderId ? getOrder(r.orderId) : null;
    codes.push({
      code,
      label: `Review reward${order ? ` · #${order.number}` : ""}`,
      ...(s.reward.kind === "pct" ? { pct: Math.min(90, Math.max(1, Math.round(s.reward.value))) } : { amount: Math.max(1, Math.round(s.reward.value)) }),
      active: true,
      usageLimit: 1,
      used: 0,
      endsAt: new Date(Date.now() + REVIEW_LINK_DAYS * 864e5).toISOString().slice(0, 10) + "T23:59:59.999Z",
      private: true,
    });
    save({ ...r, rewardCode: code });
    issued.set(r.id, code);
  }
  if (codes.length) saveSettings({ ...settings, promoCodes: [...codes, ...settings.promoCodes] });
  return issued;
}
