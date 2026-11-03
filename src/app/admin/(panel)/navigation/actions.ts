"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getContent, saveContent } from "@/server/store";
import { getT } from "@/lib/i18n/admin/server";
import type { NavLink, StoreContentAr } from "@/lib/types";

/** A link as edited in the dashboard: English label + destination, plus its Arabic label (same row, so reorders stay aligned). */
export type NavLinkInput = NavLink & { ar?: string };
export interface NavigationInput {
  nav: NavLinkInput[];
  footer: { title: string; ar?: string; links: NavLinkInput[] }[];
  announcement: NavLinkInput[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const link = (l: NavLinkInput) => ({ label: str(l?.label, 120), href: str(l?.href, 500), ar: str(l?.ar, 120) });
// site-relative paths, anchors, http(s), mailto: and tel: only — blocks javascript:/data: and protocol-relative //host
const SAFE_HREF = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i;
const MAX_LINKS = 50;

export async function saveNavigation(input: NavigationInput): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!Array.isArray(input?.nav) || !Array.isArray(input.footer) || !Array.isArray(input.announcement)) return { ok: false, error: t("content.errors.invalidNav") };
    if (input.nav.length > MAX_LINKS || input.announcement.length > MAX_LINKS || input.footer.length > 12 || input.footer.some((c) => !Array.isArray(c?.links) || c.links.length > MAX_LINKS)) return { ok: false, error: t("content.errors.tooManyLinks") };
    const nav = input.nav.map(link).filter((l) => l.label);
    if (nav.some((l) => !l.href)) return { ok: false, error: t("content.errors.navNeedsHref") };
    const footer = input.footer
      .map((c) => ({ title: str(c?.title, 120), ar: str(c?.ar, 120), links: c.links.map(link).filter((l) => l.label && l.href) }))
      .filter((c) => c.title || c.links.length);
    if (footer.some((c) => !c.title)) return { ok: false, error: t("content.errors.footerTitle") };
    const announcement = input.announcement.map(link).filter((l) => l.label);
    const bad = [...nav, ...footer.flatMap((c) => c.links), ...announcement].find((l) => l.href && !SAFE_HREF.test(l.href));
    if (bad) return { ok: false, error: t("content.errors.badLink", { label: bad.label }) };

    const plain = (l: { label: string; href: string }): NavLink => ({ label: l.label, href: l.href });
    // Arabic labels, aligned with the English rows (empty string = not translated → storefront falls back to English)
    const ar: StoreContentAr = {
      nav: nav.some((l) => l.ar) ? nav.map((l) => l.ar) : undefined,
      footer: footer.some((c) => c.ar || c.links.some((l) => l.ar)) ? footer.map((c) => ({ title: c.ar || undefined, links: c.links.map((l) => l.ar) })) : undefined,
      announcement: announcement.some((l) => l.ar) ? announcement.map((l) => ({ label: l.ar || l.label, href: l.href })) : undefined,
    };
    const current = getContent();
    saveContent({ ...current, nav: nav.map(plain), footer: footer.map((c) => ({ title: c.title, links: c.links.map(plain) })), announcement: announcement.map(plain), ar: { ...current.ar, ...ar } });
    published("Updated navigation", "Header, footer & announcement bar");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
