import { snapshot } from "./data";
import type { OfferSettings, PromoCode, SiteInfo } from "./types";

/* Store identity, offers and promo codes — edited in /admin, read from the live snapshot. */

export const getSite = (): SiteInfo => snapshot().settings.site;
export const getOffer = (): OfferSettings => snapshot().settings.offer;

/**
 * Personal codes (review rewards) aren't in the browser's snapshot; once the shopper types one and the server
 * confirms it (/api/promo), it's remembered here for this page session so totals can include it.
 */
const unlocked = new Map<string, PromoCode>();
export function unlockPromo(code: PromoCode) {
  if (typeof window !== "undefined") unlocked.set(code.code.toUpperCase(), code);
}

/** Active promo codes keyed by upper-case code (honours dates and usage limits). */
export function getPromoCodes(): Record<string, PromoCode> {
  const nowIso = new Date().toISOString();
  return Object.fromEntries(
    [...snapshot().settings.promoCodes, ...unlocked.values()]
      .filter((c) => c.active && (!c.startsAt || c.startsAt <= nowIso) && (!c.endsAt || c.endsAt >= nowIso) && (!c.usageLimit || (c.used ?? 0) < c.usageLimit))
      .map((c) => [c.code.toUpperCase(), c]),
  );
}
