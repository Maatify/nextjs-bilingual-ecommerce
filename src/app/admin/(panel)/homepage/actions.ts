"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getContent, saveContent } from "@/server/store";
import { getT } from "@/lib/i18n/admin/server";
import type { HomeContent, HomeSectionId, StoreContent, StoreContentAr } from "@/lib/types";

export type HomeAr = Pick<StoreContentAr, "hero" | "editTitle" | "setTitle" | "colourStoryTitle" | "ribbons">;

const IDS: HomeSectionId[] = ["hero", "ribbons", "categories", "edit", "matching-set", "colour-story", "reviews", "trust", "faq"];
const clean = (s: string, max = 500) => s.replace(/\r/g, "").trim().slice(0, max);
const cleanList = (l: string[]) => l.slice(0, 50).map((s) => clean(s, 200)).filter(Boolean).slice(0, 12);
// site-relative paths, anchors, http(s), mailto: and tel: only — blocks javascript:/data: and protocol-relative //host
const SAFE_HREF = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i;
const SAFE_SRC = /^(\/(?!\/)|https:\/\/)/i;

const opt = (v: unknown, max = 500) => (typeof v === "string" ? clean(v, max) || undefined : undefined);
const optList = (v: unknown) => (Array.isArray(v) ? cleanList(v.filter((x): x is string => typeof x === "string")) : []);

/** Arabic homepage copy: trimmed, capped, empty → undefined (storefront falls back to English per field). */
function cleanAr(ar: HomeAr | undefined): HomeAr {
  const h = ar?.hero ?? {};
  const hero = { eyebrow: opt(h.eyebrow), title: opt(h.title, 200), subtitle: opt(h.subtitle), primaryLabel: opt(h.primaryLabel, 120), secondaryLabel: opt(h.secondaryLabel, 120) };
  const a = optList(ar?.ribbons?.a);
  const b = optList(ar?.ribbons?.b);
  return {
    hero: Object.values(hero).some(Boolean) ? hero : undefined,
    editTitle: opt(ar?.editTitle, 200),
    setTitle: opt(ar?.setTitle, 200),
    colourStoryTitle: opt(ar?.colourStoryTitle, 200),
    ribbons: a.length || b.length ? { a, b } : undefined,
  };
}

export async function saveHomepage(input: { home: HomeContent; ribbons: StoreContent["ribbons"]; ar?: HomeAr }): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    const { home, ribbons } = input;
    if (!Array.isArray(home?.sections) || !Array.isArray(home.hero?.images) || !Array.isArray(ribbons?.a) || !Array.isArray(ribbons.b)) return { ok: false, error: t("content.errors.invalidHome") };
    if (input.ar !== undefined && (typeof input.ar !== "object" || input.ar === null)) return { ok: false, error: t("content.errors.invalidHome") };
    if (!clean(home.hero.title)) return { ok: false, error: t("content.errors.heroTitle") };
    for (const href of [clean(home.hero.primary.href), clean(home.hero.secondary.href)]) if (href && !SAFE_HREF.test(href)) return { ok: false, error: t("content.errors.heroHref") };
    // keep every known section exactly once, in the submitted order
    const seen = new Set<HomeSectionId>();
    const sections = home.sections.slice(0, 50).filter((s) => IDS.includes(s.id) && !seen.has(s.id) && seen.add(s.id)).map((s) => ({ id: s.id, enabled: !!s.enabled }));
    for (const id of IDS) if (!seen.has(id)) sections.push({ id, enabled: false });

    const next: HomeContent = {
      ...home,
      hero: {
        ...home.hero,
        eyebrow: clean(home.hero.eyebrow),
        title: clean(home.hero.title, 200),
        subtitle: clean(home.hero.subtitle),
        primary: { label: clean(home.hero.primary.label, 120), href: clean(home.hero.primary.href) },
        secondary: { label: clean(home.hero.secondary.label, 120), href: clean(home.hero.secondary.href) },
        images: [...new Set(home.hero.images.filter((u): u is string => typeof u === "string" && u.length <= 500 && SAFE_SRC.test(u)))].slice(0, 6),
        featuredProductId: String(home.hero.featuredProductId ?? "").slice(0, 100),
        autoBestsellers: home.hero.autoBestsellers === true,
      },
      sections,
      editTitle: clean(home.editTitle, 200),
      setTitle: clean(home.setTitle, 200),
      colourStoryTitle: clean(home.colourStoryTitle, 200),
    };
    const current = getContent();
    saveContent({ ...current, home: next, ribbons: { a: cleanList(ribbons.a), b: cleanList(ribbons.b) }, ar: { ...current.ar, ...cleanAr(input.ar) } });
    published("Updated homepage", "Homepage");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
