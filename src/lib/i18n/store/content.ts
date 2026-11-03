/*
 * DB content in the shopper's language. English is the base (normal fields); Arabic overrides live in
 * optional `ar` objects and fall back to English PER FIELD. Handles, ids, colour keys and categories stay
 * English (they are data keys — carts, orders and filters depend on them); only their display labels change.
 *
 * Pure + isomorphic: used by server components (via getI18n()) and client components (via useI18n()).
 */
import type { Collection, ContentPage, FaqGroup, NavLink, Product, StoreContent } from "@/lib/types";
import type { Locale } from "./config";

const pick = (ar: string | undefined, en: string) => (ar && ar.trim() ? ar : en);
const pickList = (ar: string[] | undefined, en: string[]) => (ar && ar.some((s) => s.trim()) ? ar : en);

/* ───────────── built-in Arabic labels (used when the merchant hasn't translated a value) ───────────── */

/** All 27 Egyptian governorates (keys = the English names stored on orders). */
export const GOVERNORATES_AR: Record<string, string> = {
  Cairo: "القاهرة",
  Giza: "الجيزة",
  Alexandria: "الإسكندرية",
  Qalyubia: "القليوبية",
  Sharqia: "الشرقية",
  Dakahlia: "الدقهلية",
  Gharbia: "الغربية",
  Monufia: "المنوفية",
  Beheira: "البحيرة",
  "Kafr El Sheikh": "كفر الشيخ",
  Damietta: "دمياط",
  "Port Said": "بورسعيد",
  Ismailia: "الإسماعيلية",
  Suez: "السويس",
  Faiyum: "الفيوم",
  "Beni Suef": "بني سويف",
  Minya: "المنيا",
  Asyut: "أسيوط",
  Sohag: "سوهاج",
  Qena: "قنا",
  Luxor: "الأقصر",
  Aswan: "أسوان",
  "Red Sea": "البحر الأحمر",
  "South Sinai": "جنوب سيناء",
  "North Sinai": "شمال سيناء",
  Matrouh: "مطروح",
  "New Valley": "الوادي الجديد",
};

const COLORS_AR: Record<string, string> = {
  black: "أسود",
  white: "أبيض",
  bone: "أوف وايت",
  creme: "كريمي",
  cream: "كريمي",
  sandstone: "رملي",
  army: "زيتي",
  olive: "زيتي",
  navy: "كحلي",
  brown: "بني",
  chocolate: "شوكولاتة",
  mushroom: "رمادي ترابي",
  khaki: "كاكي",
  cement: "أسمنتي",
  sage: "أخضر سيج",
  "dusty sage": "سيج فاتح",
  "dusty pink": "روز باهت",
  pink: "روز",
  grey: "رمادي",
  gray: "رمادي",
  "grey heather": "رمادي ميلانج",
  "heather grey": "رمادي ميلانج",
  "charcoal heather": "رمادي غامق ميلانج",
  charcoal: "رمادي غامق",
  forest: "أخضر غامق",
  green: "أخضر",
  blue: "أزرق",
  red: "أحمر",
  beige: "بيج",
  stone: "حجري",
};

const CATEGORIES_AR: Record<string, string> = {
  Hoodies: "هوديز",
  Sweatshirts: "سويت شيرت",
  "T-Shirts": "تيشيرتات",
  Tees: "تيشيرتات",
  Sweatpants: "بناطيل سويت",
  Shorts: "شورتات",
  Jackets: "جواكت",
  Accessories: "إكسسوارات",
};

/** Default collection names (the merchant's own `ar.title` always wins). */
const COLLECTIONS_AR: Record<string, string> = {
  all: "كل المنتجات",
  bestsellers: "الأكثر مبيعًا",
  new: "نزل جديد",
  hoodies: "هوديز",
  sweatshirts: "سويت شيرت",
  tees: "تيشيرتات",
  sweatpants: "بناطيل سويت",
  shorts: "شورتات",
  men: "رجالي",
  women: "حريمي",
  basics: "الأساسيات",
  sale: "تخفيضات",
};

/* ───────────── products ───────────── */

const productCache = new WeakMap<Product, Product>();

/** Product with Arabic text fields swapped in (per-field fallback). Keys (handle, colours, sizes, category) stay English. */
export function localizeProduct(p: Product, locale: Locale): Product {
  if (locale !== "ar") return p;
  const hit = productCache.get(p);
  if (hit) return hit;
  const a = p.ar ?? {};
  const out: Product = {
    ...p,
    title: pick(a.title, p.title),
    tagline: pick(a.tagline, p.tagline),
    description: pick(a.description, p.description),
    highlights: pickList(a.highlights, p.highlights),
    material: pick(a.material, p.material),
    care: pickList(a.care, p.care),
    modelInfo: a.modelInfo?.trim() ? a.modelInfo : p.modelInfo,
    seoTitle: a.seoTitle?.trim() ? a.seoTitle : p.ar?.title ? undefined : p.seoTitle,
    seoDescription: a.seoDescription?.trim() ? a.seoDescription : p.ar?.tagline ? undefined : p.seoDescription,
  };
  productCache.set(p, out);
  return out;
}

/** Display name of a colour (the English name stays the cart/order key). */
export function colorName(p: Pick<Product, "ar"> | null | undefined, name: string, locale: Locale): string {
  if (locale !== "ar") return name;
  const own = p?.ar?.colors?.[name];
  if (own && own.trim()) return own;
  return COLORS_AR[name.trim().toLowerCase()] ?? name;
}

/** Display label of a product category ("Hoodies" → "هوديز"). */
export function categoryName(p: Pick<Product, "ar" | "category">, locale: Locale): string {
  if (locale !== "ar") return p.category;
  return pick(p.ar?.category, CATEGORIES_AR[p.category] ?? p.category);
}

export const categoryLabel = (category: string, locale: Locale) => (locale === "ar" ? (CATEGORIES_AR[category] ?? category) : category);

export const governorateName = (name: string, locale: Locale) => (locale === "ar" ? (GOVERNORATES_AR[name] ?? name) : name);

/* ───────────── collections ───────────── */

const collectionCache = new WeakMap<Collection, Collection>();

export function localizeCollection(c: Collection, locale: Locale): Collection {
  if (locale !== "ar") return c;
  const hit = collectionCache.get(c);
  if (hit) return hit;
  const a = c.ar ?? {};
  const out: Collection = {
    ...c,
    title: pick(a.title, COLLECTIONS_AR[c.handle] ?? c.title),
    description: pick(a.description, c.description),
    seoTitle: a.seoTitle?.trim() ? a.seoTitle : a.title ? undefined : c.seoTitle,
    seoDescription: a.seoDescription?.trim() ? a.seoDescription : a.description ? undefined : c.seoDescription,
  };
  collectionCache.set(c, out);
  return out;
}

/* ───────────── content pages ───────────── */

export function localizePage(p: ContentPage, locale: Locale): ContentPage {
  if (locale !== "ar" || !p.ar) return p;
  const a = p.ar;
  return {
    ...p,
    title: pick(a.title, p.title),
    accent: a.accent?.trim() ? a.accent : a.title ? "" : p.accent,
    nav: pick(a.nav, p.nav),
    description: pick(a.description, p.description),
    intro: pick(a.intro, p.intro),
    sections: a.sections?.length ? a.sections : p.sections,
  };
}

/* ───────────── store content (nav, announcement, ribbons, hero, footer, FAQ) ───────────── */

const relabel = (links: NavLink[], labels: string[] | undefined) => links.map((l, i) => ({ ...l, label: pick(labels?.[i], l.label) }));

const contentCache = new WeakMap<StoreContent, StoreContent>();

export function localizeContent(c: StoreContent, locale: Locale): StoreContent {
  if (locale !== "ar") return c;
  const hit = contentCache.get(c);
  if (hit) return hit;
  const a = c.ar ?? {};
  const h = a.hero ?? {};
  const announcement = a.announcement?.some((m) => m.label.trim()) ? a.announcement.map((m, i) => ({ label: m.label, href: m.href || c.announcement[i]?.href || "/" })) : c.announcement;
  const faq: FaqGroup[] = a.faq?.length ? a.faq : c.faq;
  const out: StoreContent = {
    ...c,
    announcement,
    ribbons: { a: pickList(a.ribbons?.a, c.ribbons.a), b: pickList(a.ribbons?.b, c.ribbons.b) },
    nav: relabel(c.nav, a.nav),
    footer: c.footer.map((col, i) => ({ title: pick(a.footer?.[i]?.title, col.title), links: relabel(col.links, a.footer?.[i]?.links) })),
    faq,
    pages: c.pages.map((p) => localizePage(p, locale)),
    home: {
      ...c.home,
      hero: {
        ...c.home.hero,
        eyebrow: pick(h.eyebrow, c.home.hero.eyebrow),
        title: pick(h.title, c.home.hero.title),
        subtitle: pick(h.subtitle, c.home.hero.subtitle),
        primary: { ...c.home.hero.primary, label: pick(h.primaryLabel, c.home.hero.primary.label) },
        secondary: { ...c.home.hero.secondary, label: pick(h.secondaryLabel, c.home.hero.secondary.label) },
      },
      editTitle: pick(a.editTitle, c.home.editTitle),
      setTitle: pick(a.setTitle, c.home.setTitle),
      colourStoryTitle: pick(a.colourStoryTitle, c.home.colourStoryTitle),
    },
  };
  contentCache.set(c, out);
  return out;
}
