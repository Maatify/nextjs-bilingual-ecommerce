"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getContent, saveContent } from "@/server/store";
import { getT } from "@/lib/i18n/admin/server";
import type { ContentPage, ContentPageAr, ContentSection } from "@/lib/types";

const cleanSections = (sections: ContentSection[]) =>
  sections
    .map((s): ContentSection => {
      const list = Array.isArray(s.list) ? s.list.map((x) => String(x ?? "").trim().slice(0, 1000)).filter(Boolean) : undefined;
      return { heading: String(s.heading ?? "").trim().slice(0, 200), body: s.body.map((p) => String(p ?? "").trim().slice(0, 10000)).filter(Boolean), ...(list?.length ? { list } : {}) };
    })
    .filter((s) => s.heading || s.body.length || s.list?.length);

const badSections = (v: unknown) =>
  v !== undefined && (!Array.isArray(v) || v.length > 100 || v.some((s) => !s || typeof s !== "object" || !Array.isArray(s.body) || s.body.length > 100 || (s.list !== undefined && (!Array.isArray(s.list) || s.list.length > 100))));

/** Arabic page copy: trimmed + capped like the English fields; empty → undefined (falls back to English). */
function cleanAr(ar: ContentPageAr | undefined): ContentPageAr | undefined {
  if (!ar || typeof ar !== "object") return undefined;
  const opt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined);
  const sections = Array.isArray(ar.sections) ? cleanSections(ar.sections) : [];
  const out: ContentPageAr = { title: opt(ar.title, 200), accent: opt(ar.accent, 200), nav: opt(ar.nav, 200), description: opt(ar.description, 1000), intro: opt(ar.intro, 5000), sections: sections.length ? sections : undefined };
  return Object.values(out).some((v) => v !== undefined) ? out : undefined;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export async function createPage(input: { title: string; slug: string }): Promise<ActionResult<{ slug: string }>> {
  await guard();
  const { t } = await getT();
  try {
    const title = String(input?.title ?? "").trim().slice(0, 200);
    const slug = String(input?.slug ?? "").trim().slice(0, 80) || slugify(title);
    if (!title) return { ok: false, error: t("content.errors.pageTitle") };
    if (!SLUG.test(slug)) return { ok: false, error: t("content.errors.slug") };
    const c = getContent();
    if (c.pages.some((p) => p.slug === slug)) return { ok: false, error: t("content.errors.slugTaken", { slug }) };
    const page: ContentPage = { slug, title, nav: title, description: "", intro: "", sections: [{ heading: "", body: [""] }], published: false };
    saveContent({ ...c, pages: [...c.pages, page] });
    published("Created page", title, `/pages/${slug}`);
    return { ok: true, data: { slug } };
  } catch (e) {
    return fail(e);
  }
}

export async function savePage(prevSlug: string, page: ContentPage): Promise<ActionResult<{ slug: string }>> {
  await guard();
  const { t } = await getT();
  try {
    if (!page || typeof page !== "object" || typeof page.slug !== "string" || typeof page.title !== "string") return { ok: false, error: t("content.errors.pageNeedsTitle") };
    const slug = page.slug.trim().slice(0, 80);
    if (!page.title.trim()) return { ok: false, error: t("content.errors.pageNeedsTitle") };
    if (!Array.isArray(page.sections) || badSections(page.sections) || (page.ar !== undefined && (typeof page.ar !== "object" || badSections(page.ar?.sections)))) return { ok: false, error: t("content.errors.tooManySections") };
    if (!SLUG.test(slug)) return { ok: false, error: t("content.errors.slug") };
    const c = getContent();
    const idx = c.pages.findIndex((p) => p.slug === prevSlug);
    if (idx < 0) return { ok: false, error: t("content.errors.pageGone") };
    if (slug !== prevSlug && c.pages.some((p) => p.slug === slug)) return { ok: false, error: t("content.errors.slugTaken", { slug }) };
    const clean: ContentPage = {
      slug,
      title: page.title.trim().slice(0, 200),
      accent: page.accent?.trim().slice(0, 200) || undefined,
      nav: (String(page.nav ?? "").trim() || page.title.trim()).slice(0, 200),
      description: String(page.description ?? "").trim().slice(0, 1000),
      intro: String(page.intro ?? "").trim().slice(0, 5000),
      sections: cleanSections(page.sections),
      published: page.published !== false,
      ar: cleanAr(page.ar),
    };
    const pages = [...c.pages];
    pages[idx] = clean;
    // keep footer/header/announcement links pointing at the renamed page
    const fix = <T extends { href: string }>(l: T) => (slug !== prevSlug && l.href === `/pages/${prevSlug}` ? { ...l, href: `/pages/${slug}` } : l);
    saveContent({ ...c, pages, nav: c.nav.map(fix), announcement: c.announcement.map(fix), footer: c.footer.map((f) => ({ ...f, links: f.links.map(fix) })) });
    published("Updated page", clean.nav, `/pages/${slug}`);
    return { ok: true, data: { slug } };
  } catch (e) {
    return fail(e);
  }
}

export async function setPagePublished(slug: string, value: boolean): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    const c = getContent();
    const page = c.pages.find((p) => p.slug === slug);
    if (!page) return { ok: false, error: t("content.errors.pageNotFound") };
    saveContent({ ...c, pages: c.pages.map((p) => (p.slug === slug ? { ...p, published: value } : p)) });
    published(value ? "Published page" : "Unpublished page", page.nav, `/pages/${slug}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePage(slug: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    const c = getContent();
    const page = c.pages.find((p) => p.slug === slug);
    if (!page) return { ok: false, error: t("content.errors.pageNotFound") };
    saveContent({ ...c, pages: c.pages.filter((p) => p.slug !== slug) });
    published("Deleted page", page.nav, `/pages/${slug}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
