"use server";

import type { TFn } from "@/lib/i18n/admin";
import { getT } from "@/lib/i18n/admin/server";
import type { OfferSettings, PromoCode, ReviewSettings } from "@/lib/types";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getReviewSettings, getSettings, saveReviewSettings, saveSettings } from "@/server/store";

const CODE_RE = /^[A-Z0-9_-]{3,24}$/;
const num = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
};

function clean(t: TFn, input: PromoCode): PromoCode {
  const code = String(input.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) throw new Error(t("sales.discounts.err.codeServer"));
  const pct = input.pct ? num(input.pct, 1, 90) : undefined;
  const amount = !pct && input.amount ? num(input.amount, 1, 1_000_000) : undefined;
  if (!pct && !amount) throw new Error(t("sales.discounts.err.pctOrAmount"));
  // stored as ISO-comparable strings: start of the first day, end of the last day (inclusive)
  const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined);
  const startsAt = day(input.startsAt);
  const endDay = day(input.endsAt);
  const endsAt = endDay ? `${endDay}T23:59:59.999Z` : undefined;
  if (startsAt && endsAt && endsAt < startsAt) throw new Error(t("sales.discounts.err.endAfter"));
  return {
    code,
    label: String(input.label ?? "").trim().slice(0, 80) || (pct ? `${pct}% off` : `EGP ${amount} off`),
    pct,
    amount,
    minSubtotal: input.minSubtotal ? num(input.minSubtotal, 0) || undefined : undefined,
    usageLimit: input.usageLimit ? num(input.usageLimit, 1) : undefined,
    used: num(input.used, 0) ?? 0,
    startsAt,
    endsAt,
    active: !!input.active,
  };
}

export async function savePromoCode(input: PromoCode, original?: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!input || typeof input !== "object" || (original !== undefined && typeof original !== "string")) return { ok: false, error: t("sales.discounts.err.invalid") };
    const promo = clean(t, input);
    const s = getSettings();
    const list = s.promoCodes.filter((p) => p.code !== original);
    if (list.some((p) => p.code === promo.code)) return { ok: false, error: t("sales.discounts.err.exists", { code: promo.code }) };
    const idx = original ? s.promoCodes.findIndex((p) => p.code === original) : -1;
    if (idx >= 0) list.splice(idx, 0, { ...promo, used: s.promoCodes[idx].used ?? promo.used });
    else list.unshift(promo);
    saveSettings({ ...s, promoCodes: list });
    published(original ? "Updated promo code" : "Created promo code", promo.code);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function togglePromoCode(code: string, active: boolean): Promise<ActionResult> {
  await guard();
  try {
    const s = getSettings();
    if (typeof code !== "string" || !s.promoCodes.some((p) => p.code === code)) return { ok: false, error: (await getT()).t("sales.discounts.err.notFound") };
    active = !!active;
    saveSettings({ ...s, promoCodes: s.promoCodes.map((p) => (p.code === code ? { ...p, active } : p)) });
    published(active ? "Activated promo code" : "Paused promo code", code);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePromoCode(code: string): Promise<ActionResult> {
  await guard();
  try {
    const s = getSettings();
    saveSettings({ ...s, promoCodes: s.promoCodes.filter((p) => p.code !== code) });
    published("Deleted promo code", code);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveOffer(input: OfferSettings): Promise<ActionResult> {
  await guard();
  try {
    const s = getSettings();
    const { t } = await getT();
    if (!input || typeof input !== "object") return { ok: false, error: t("sales.discounts.err.invalidOffer") };
    const welcomeCode = String(input.welcomeCode ?? "").trim().toUpperCase();
    if (welcomeCode && !CODE_RE.test(welcomeCode)) return { ok: false, error: t("sales.discounts.err.welcomeCode") };
    const buy = num(input.bogo?.buy, 1, 20) ?? 2;
    const get = num(input.bogo?.get, 1, 20) ?? 1;
    // multi-buy % (e.g. 2 pieces → 20% off): qty 2–10, pct 1–90 — an out-of-range value is an error, not clamped
    const prevMulti = s.offer.multiBuy ?? { enabled: true, qty: 2, pct: 20 };
    const mb = input.multiBuy ?? prevMulti;
    const mQty = Number(mb.qty);
    const mPct = Number(mb.pct);
    if (!Number.isInteger(mQty) || mQty < 2 || mQty > 10) return { ok: false, error: t("sales.discounts.err.multiQty") };
    if (!Number.isFinite(mPct) || mPct < 1 || mPct > 90) return { ok: false, error: t("sales.discounts.err.multiPct") };
    const offer: OfferSettings = {
      ...s.offer,
      bogoEnabled: !!input.bogoEnabled,
      bogo: { buy, get },
      multiBuy: { enabled: !!mb.enabled, qty: mQty, pct: Math.round(mPct) },
      freeShippingAt: num(input.freeShippingAt, 0) ?? s.offer.freeShippingAt,
      giftAt: num(input.giftAt, 0) ?? s.offer.giftAt,
      giftName: String(input.giftName ?? "").trim().slice(0, 80),
      prepaidDiscountPct: num(input.prepaidDiscountPct, 0, 50) ?? 0,
      welcomeCode,
      welcomePct: num(input.welcomePct, 0, 90) ?? 0,
      cutoffHour: num(input.cutoffHour, 0, 23) ?? s.offer.cutoffHour,
    };
    saveSettings({ ...s, offer });
    published("Updated automatic offers");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Discounts & offers → Review reward. */
export async function saveReviewReward(input: ReviewSettings["reward"]): Promise<ActionResult> {
  await guard();
  try {
    const { t } = await getT();
    if (!input || typeof input !== "object") return { ok: false, error: t("reviews.errors.invalid") };
    const kind = input.kind === "amount" ? "amount" : input.kind === "pct" ? "pct" : null;
    if (!kind) return { ok: false, error: t("reviews.errors.invalid") };
    const value = Number(input.value);
    if (kind === "pct" && (!Number.isInteger(value) || value < 1 || value > 90)) return { ok: false, error: t("reviews.reward.invalidPct") };
    if (kind === "amount" && (!Number.isFinite(value) || value < 1 || value > 1_000_000)) return { ok: false, error: t("reviews.reward.invalidAmount") };
    const reward = { enabled: input.enabled === true, kind, value: Math.round(value), photoRequired: input.photoRequired === true } as const;
    saveReviewSettings({ ...getReviewSettings(), reward });
    published(reward.enabled ? "Updated review reward" : "Turned off review reward", kind === "pct" ? `${reward.value}%` : `EGP ${reward.value}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
