import { SEED_SETTINGS } from "@/lib/seed/content";
import { passwordInfo } from "@/server/security/password";
import { totpEnabled } from "@/server/security/totp";
import { getDb, getContent, getSettings, listProducts } from "@/server/store";

/*
 * Shopify-style setup guide for the Home page. Every step is computed from real data —
 * nothing is ticked by hand. Dismissal is stored in the kv table.
 */

export type SetupStepKey = "products" | "homepage" | "shipping" | "payments" | "contact" | "security" | "order";
export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
}

const DISMISS_KEY = "setup_guide_dismissed";
const PLACEHOLDER_WHATSAPP = "201000000000";
const PLACEHOLDER_EMAIL = "care@vedra.store";

function activityMatches(action: string, detailLike?: string) {
  const db = getDb();
  const row = detailLike
    ? db.prepare("SELECT 1 FROM activity WHERE action = ? AND (target LIKE ? OR detail LIKE ?) LIMIT 1").get(action, `%${detailLike}%`, `%${detailLike}%`)
    : db.prepare("SELECT 1 FROM activity WHERE action = ? LIMIT 1").get(action);
  return !!row;
}

export function setupSteps(): SetupStep[] {
  const db = getDb();
  const s = getSettings();
  const content = getContent();
  // the activity log only has merchant edits (seeding/migrations don't log product saves)
  const products = !!db.prepare("SELECT 1 FROM activity WHERE action IN ('Created product', 'Updated product', 'Quick-edited product', 'Duplicated product') OR action LIKE 'Bulk-edited%' LIMIT 1").get() && listProducts().length > 0;
  const homepage = activityMatches("Updated homepage") || activityMatches("Updated navigation") || (content.home.hero.autoBestsellers ?? false);
  const shipping = JSON.stringify(s.governorates) !== JSON.stringify(SEED_SETTINGS.governorates) || s.offer.shipping !== SEED_SETTINGS.offer.shipping || activityMatches("Updated settings", "governorates") || activityMatches("Updated settings", "shipping");
  const payments = JSON.stringify(s.payments) !== JSON.stringify(SEED_SETTINGS.payments) || activityMatches("Updated settings", "payments");
  const contact = !!s.site.whatsapp && s.site.whatsapp.replace(/\D/g, "") !== PLACEHOLDER_WHATSAPP && !!s.site.email && s.site.email.toLowerCase() !== PLACEHOLDER_EMAIL;
  let security = false;
  try {
    security = totpEnabled() || !passwordInfo().weak;
  } catch {
    /* security tables unavailable */
  }
  const order = !!db.prepare("SELECT 1 FROM orders WHERE demo = 0 AND status != 'draft' LIMIT 1").get();
  return [
    { key: "products", done: products },
    { key: "homepage", done: homepage },
    { key: "shipping", done: shipping },
    { key: "payments", done: payments },
    { key: "contact", done: contact },
    { key: "security", done: security },
    { key: "order", done: order },
  ];
}

export function setupDismissed() {
  return !!getDb().prepare("SELECT 1 FROM kv WHERE key = ?").get(DISMISS_KEY);
}

export function setSetupDismissed(dismissed: boolean) {
  const db = getDb();
  if (dismissed) db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(DISMISS_KEY, JSON.stringify({ at: new Date().toISOString() }));
  else db.prepare("DELETE FROM kv WHERE key = ?").run(DISMISS_KEY);
}
