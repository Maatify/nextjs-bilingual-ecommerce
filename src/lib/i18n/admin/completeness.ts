import type { Collection, ContentPage, Product } from "@/lib/types";

/*
 * Arabic translation completeness — shared by editors (meter) and lists ("missing translation" filter).
 * Only fields that have English content count. Rich text is compared on its plain text.
 */
export type Completeness = { done: number; total: number };

const has = (v: unknown): boolean =>
  Array.isArray(v) ? v.some((x) => (typeof x === "string" ? x.trim().length > 0 : has(x))) : typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().length > 0 : v !== null && v !== undefined && typeof v === "object" ? Object.values(v).some(has) : false;

export function countPairs(pairs: [unknown, unknown][]): Completeness {
  const relevant = pairs.filter(([en]) => has(en));
  return { done: relevant.filter(([, ar]) => has(ar)).length, total: relevant.length };
}

/** title, tagline, description, highlights, material, care, model info, product type, SEO title/description, colour names */
export function productCompleteness(p: Product): Completeness {
  const ar = p.ar ?? {};
  const colorNames = p.colors.map((c) => c.name).filter(Boolean);
  const colorsDone = colorNames.length > 0 && colorNames.every((n) => has(ar.colors?.[n]));
  return countPairs([
    [p.title, ar.title],
    [p.tagline, ar.tagline],
    [p.description, ar.description],
    [p.highlights, ar.highlights],
    [p.material, ar.material],
    [p.care, ar.care],
    [p.modelInfo, ar.modelInfo],
    [p.category, ar.category],
    [p.seoTitle, ar.seoTitle],
    [p.seoDescription, ar.seoDescription],
    [colorNames.length ? "colours" : "", colorsDone ? "yes" : ""],
  ]);
}

export function collectionCompleteness(c: Collection): Completeness {
  const ar = c.ar ?? {};
  return countPairs([
    [c.title, ar.title],
    [c.description, ar.description],
    [c.seoTitle, ar.seoTitle],
    [c.seoDescription, ar.seoDescription],
  ]);
}

export function pageCompleteness(p: ContentPage): Completeness {
  const ar = p.ar ?? {};
  return countPairs([
    [p.title, ar.title],
    [p.accent, ar.accent],
    [p.nav, ar.nav],
    [p.description, ar.description],
    [p.intro, ar.intro],
    [p.sections.length ? p.sections : "", ar.sections?.length ? ar.sections : ""],
  ]);
}

export const isMissing = (c: Completeness) => c.total > 0 && c.done < c.total;
