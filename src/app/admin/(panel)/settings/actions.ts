"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getContent, getProduct, getSettings, saveContent, saveSettings } from "@/server/store";
import { getT } from "@/lib/i18n/admin/server";
import { SOCIAL_NETWORKS, type SocialKey } from "@/lib/social";
import type { CheckoutSettings, Governorate, PaymentSettings, SiteInfo, StoreContent } from "@/lib/types";

export interface SettingsInput {
  site: SiteInfo;
  governorates: Governorate[];
  /** default flat shipping fee (offer.shipping) — the rest of `offer` belongs to Discounts */
  shipping: number;
  payments: PaymentSettings;
  checkout: CheckoutSettings;
  popups: StoreContent["popups"];
}

const num = (n: unknown, min = 0, max = 1e6) => Math.min(max, Math.max(min, Math.round(Number(n) || 0)));
const cap = (s: string, max = 200) => s.trim().slice(0, max);

export async function saveStoreSettings(input: SettingsInput, changed: string[]): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    const s = input.site;
    if (!s.name.trim()) return { ok: false, error: t("content.errors.storeName") };
    if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) return { ok: false, error: t("content.errors.email") };
    if (s.url && !/^https?:\/\/\S+$/.test(s.url.trim())) return { ok: false, error: t("content.errors.url") };
    // rendered as <a href> in the storefront footer — only allow http(s) links
    if (SOCIAL_NETWORKS.some((n) => (s[n.key] ?? "").trim() && !/^https?:\/\/\S+$/.test((s[n.key] ?? "").trim()))) return { ok: false, error: t("content.errors.social") };
    if (!Array.isArray(input.governorates) || input.governorates.length > 100 || input.governorates.some((g) => typeof g?.name !== "string" || !Array.isArray(g.days))) return { ok: false, error: t("content.errors.govs") };
    if (!Array.isArray(changed)) return { ok: false, error: t("content.errors.request") };
    const whatsapp = s.whatsapp.replace(/\D/g, "");
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) return { ok: false, error: t("content.errors.whatsapp") };
    const p = input.payments;
    if (!p.cod && !p.card && !p.wallet && !p.installments) return { ok: false, error: t("content.errors.payment") };
    if (input.governorates.every((g) => g.enabled === false)) return { ok: false, error: t("content.errors.govEnabled") };
    const c = input.checkout;
    if (c.orderBumpEnabled && !getProduct(c.orderBumpProductId)) return { ok: false, error: t("content.errors.bump") };

    const current = getSettings();
    saveSettings({
      ...current,
      site: {
        ...current.site,
        name: cap(s.name),
        legalName: cap(s.legalName),
        url: cap(s.url, 500).replace(/\/$/, ""),
        description: cap(s.description, 2000),
        descriptionAr: typeof s.descriptionAr === "string" ? cap(s.descriptionAr, 2000) || undefined : undefined,
        email: cap(s.email),
        phone: cap(s.phone, 40),
        whatsapp,
        ...(Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.key, cap(s[n.key] ?? "", 500)])) as Record<SocialKey, string>),
        socialRail: s.socialRail !== false,
      },
      offer: { ...current.offer, shipping: num(input.shipping, 0, 10000) },
      governorates: input.governorates.map((g) => {
        const a = num(g.days[0], 0, 30);
        const b = num(g.days[1], 0, 30);
        return { name: g.name.slice(0, 100), rate: num(g.rate, 0, 10000), days: [Math.min(a, b), Math.max(a, b)] as [number, number], enabled: g.enabled !== false };
      }),
      payments: { cod: !!p.cod, card: !!p.card, wallet: !!p.wallet, installments: !!p.installments },
      checkout: { protectionEnabled: !!c.protectionEnabled, expressEnabled: !!c.expressEnabled, expressFee: num(c.expressFee, 0, 10000), orderBumpEnabled: !!c.orderBumpEnabled, orderBumpProductId: String(c.orderBumpProductId ?? "").slice(0, 64) },
    });
    const pop = input.popups;
    const content = getContent();
    saveContent({ ...content, popups: { welcome: !!pop.welcome, welcomeDelaySec: num(pop.welcomeDelaySec, 0, 600), socialProof: !!pop.socialProof, whatsapp: !!pop.whatsapp } });
    published("Updated settings", changed.length ? changed.slice(0, 20).map((x) => String(x).slice(0, 60)).join(", ") : "Settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
