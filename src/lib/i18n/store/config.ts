/*
 * Storefront i18n core — isomorphic, dependency-free (safe in client bundles, the proxy and route handlers).
 *
 * URLs: English lives at the unprefixed URLs (/products/x), Arabic under /ar (/ar/products/x).
 * Internally every storefront route sits under app/[lang]; src/proxy.ts rewrites unprefixed URLs to /en/….
 */
import type { Locale } from "@/lib/types";

export type { Locale };

export const LOCALES: Locale[] = ["en", "ar"];
/** Remembers the shopper's language choice (set by the language switcher, read by the proxy). */
export const LANG_COOKIE = "vedra_lang";

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "ar";
export const asLocale = (v: unknown): Locale => (v === "ar" ? "ar" : "en");
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");
/** BCP-47 tag for Intl: Arabic words, Western digits (Egyptian e-commerce convention). */
export const intlLocale = (l: Locale) => (l === "ar" ? "ar-EG-u-nu-latn" : "en-GB");
/** Open Graph locales (Facebook/WhatsApp only recognise its own list — en_US, not en_EG). */
export const ogLocale = (l: Locale) => (l === "ar" ? "ar_EG" : "en_US");

/** Paths that never get a locale prefix. */
const UNPREFIXED = /^\/(api|admin|media|_next|p\/|icon|sitemap|robots|manifest)/;

/** Split "/ar/products/x" → { locale: "ar", path: "/products/x" }; "/products/x" → { locale: "en", path: "/products/x" }. */
export function stripLocale(pathname: string): { locale: Locale; path: string } {
  if (pathname === "/ar" || pathname.startsWith("/ar/")) return { locale: "ar", path: pathname.slice(3) || "/" };
  if (pathname === "/en" || pathname.startsWith("/en/")) return { locale: "en", path: pathname.slice(3) || "/" };
  return { locale: "en", path: pathname || "/" };
}

/** Localise an internal href ("/collections/all?x=1#grid") for a locale. External / special URLs pass through. */
export function localeHref(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const pathname = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? "" : href.slice(cut);
  if (UNPREFIXED.test(pathname)) return href;
  const { path } = stripLocale(pathname);
  if (locale === "en") return path + rest;
  return (path === "/" ? "/ar" : `/ar${path}`) + rest;
}

/* ───────────── dictionaries ───────────── */

export type PluralForms = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };

/** Same keys as T with every leaf widened — the Arabic dictionary must mirror the English one exactly. */
export type Widen<T> = T extends string ? string : T extends { other: string } ? PluralForms : { [K in keyof T]: Widen<T[K]> };

export type Vars = Record<string, string | number | null | undefined>;

/** "Hello {name}" → "Hello Sara". Numbers are printed with Western digits + grouping. */
export function fmt(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    if (v === undefined || v === null) return m;
    return typeof v === "number" ? v.toLocaleString("en-US") : v;
  });
}

const rules: Partial<Record<Locale, Intl.PluralRules>> = {};
/** Pick the plural form for `n` (Arabic uses zero/one/two/few/many/other) and interpolate {n} + vars. */
export function plural(locale: Locale, forms: PluralForms | string, n: number, vars?: Vars): string {
  if (typeof forms === "string") return fmt(forms, { n, ...vars });
  const r = (rules[locale] ??= new Intl.PluralRules(locale));
  const cat = (n === 0 && forms.zero ? "zero" : r.select(n)) as keyof PluralForms;
  return fmt(forms[cat] ?? forms.other, { n, ...vars });
}

/* ───────────── numbers, money, dates ───────────── */

const egp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "EGP 1,590" (en) · "1,590 ج.م" (ar) — Western digits in both. */
export const formatMoney = (n: number, locale: Locale = "en") =>
  locale === "ar" ? `${egp.format(Math.round(n))} ج.م` : `EGP ${egp.format(Math.round(n))}`;

export const formatNumber = (n: number) => egp.format(n);

// Safari's ICU writes Arabic dates as "17 أكتوبر، 2026" while Node writes "17 أكتوبر 2026": the extra comma made the server
// HTML and the browser render differ (a hydration error on the product page reviews), so it's dropped before the year
export const formatDate = (d: Date | string, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(d).toLocaleDateString(intlLocale(locale), opts).replace(/،\s*(?=[\d٠-٩]{4})/, " ");
