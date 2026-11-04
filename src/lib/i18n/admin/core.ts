/*
 * Admin i18n core — isomorphic (no React, no next/headers). Used by the server helper
 * (./server.ts → getT()) and the client provider (src/components/admin/i18n/provider.tsx → useT()).
 *
 * Dictionaries: ./en/<namespace>.ts is the source of truth; ./ar/<namespace>.ts must satisfy
 * Widen<typeof en> (same keys). A leaf is a string ("Hello {name}") or a plural object
 * ({ one: "{count} order", other: "{count} orders" } — Arabic adds zero/two/few/many).
 * The key `other` is RESERVED for plural objects — never use it as a normal key.
 */

export type AdminLocale = "en" | "ar";
export const ADMIN_LANG_COOKIE = "vedra_admin_lang";
export const DEFAULT_ADMIN_LOCALE: AdminLocale = "ar";
export const ADMIN_LOCALES: AdminLocale[] = ["ar", "en"];
export const isAdminLocale = (v: unknown): v is AdminLocale => v === "en" || v === "ar";
export const dirOf = (l: AdminLocale) => (l === "ar" ? "rtl" : "ltr");

export type PluralForms = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
type Leaf = string | PluralForms;

/** Same keys as T, with every leaf widened (so the Arabic dictionary must mirror the English one). */
export type Widen<T> = T extends string ? string : T extends { other: string } ? PluralForms : { [K in keyof T]: Widen<T[K]> };

/** Every dotted leaf path of a dictionary, e.g. "common.save" | "sales.status.pending". */
export type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends { other: string } ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type Vars = Record<string, string | number | null | undefined>;

/** Intl locale tag: Arabic month names but Western digits (Egyptian e-commerce convention). */
export const intlLocale = (l: AdminLocale) => (l === "ar" ? "ar-EG-u-nu-latn" : "en-GB");

const pluralRules: Partial<Record<AdminLocale, Intl.PluralRules>> = {};
const rulesFor = (l: AdminLocale) => (pluralRules[l] ??= new Intl.PluralRules(l === "ar" ? "ar" : "en"));
const nf: Partial<Record<AdminLocale, Intl.NumberFormat>> = {};
const numFmt = (l: AdminLocale) => (nf[l] ??= new Intl.NumberFormat(l === "ar" ? "ar-EG-u-nu-latn" : "en", { maximumFractionDigits: 2 }));

function lookup(dict: unknown, key: string): Leaf | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" || (cur && typeof cur === "object" && "other" in cur) ? (cur as Leaf) : undefined;
}

function interpolate(s: string, vars: Vars | undefined, locale: AdminLocale) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    if (v === undefined || v === null) return m;
    const out = typeof v === "number" ? numFmt(locale).format(v) : v;
    // Arabic: isolate Latin/number runs ("0.0%", "EGP 1,200", "#1042") so bidi can't reorder them (LRI … PDI)
    return locale === "ar" && /[0-9A-Za-z%]/.test(out) && !/[\u0600-\u06FF]/.test(out) ? `\u2066${out}\u2069` : out;
  });
}

/** Resolve + interpolate a key. Falls back to the English dictionary, then to the key itself. */
export function translate(dict: unknown, fallback: unknown, locale: AdminLocale, key: string, vars?: Vars): string {
  const leaf = lookup(dict, key) ?? lookup(fallback, key);
  if (leaf === undefined) return key;
  if (typeof leaf === "string") return interpolate(leaf, vars, locale);
  const n = Number(vars?.count ?? 0);
  const cat = rulesFor(locale).select(n) as keyof PluralForms;
  // Arabic "zero" is optional in dictionaries — fall back to other
  const s = leaf[cat] ?? (n === 0 ? leaf.zero : undefined) ?? leaf.other;
  return interpolate(s, vars, locale);
}

/* ───────────── formatting ───────────── */

const TZ = "Africa/Cairo";

export function makeFormat(locale: AdminLocale) {
  const tag = intlLocale(locale);
  const cache = new Map<string, Intl.DateTimeFormat>();
  const dtf = (opts: Intl.DateTimeFormatOptions) => {
    const k = JSON.stringify(opts);
    let f = cache.get(k);
    if (!f) cache.set(k, (f = new Intl.DateTimeFormat(tag, { timeZone: TZ, ...opts })));
    return f;
  };
  const toDate = (d: string | number | Date) => (d instanceof Date ? d : new Date(d));
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "short" });
  const fmt = {
    locale,
    tag,
    /** 1,234 (Western digits in both languages) */
    number: (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en", { maximumFractionDigits: 0, ...opts }).format(n),
    /** "EGP 1,234" — kept identical in both languages (LTR-safe, matches the storefront) */
    money: (n: number) => `EGP ${Math.round(n).toLocaleString("en")}`,
    percent: (n: number, digits = 0) => `${n.toFixed(digits)}%`,
    /** 12 Mar 2026 / ١٢ مارس 2026 */
    date: (d: string | number | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => dtf(opts).format(toDate(d)),
    /** 12 Mar, 14:05 */
    dateTime: (d: string | number | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) => dtf(opts).format(toDate(d)),
    time: (d: string | number | Date) => dtf({ hour: "2-digit", minute: "2-digit" }).format(toDate(d)),
    /** short month label for charts: "Mar" / "مارس" */
    month: (d: string | number | Date, style: "short" | "long" = "short") => dtf({ month: style }).format(toDate(d)),
    weekday: (d: string | number | Date, style: "short" | "long" = "short") => dtf({ weekday: style }).format(toDate(d)),
    /** "5m ago" / "منذ ٥ د" style relative time; older than 30 days → date */
    ago: (iso: string | number | Date) => {
      const s = Math.max(1, Math.round((Date.now() - toDate(iso).getTime()) / 1000));
      if (s < 45) return rtf.format(-s, "second");
      const m = Math.round(s / 60);
      if (m < 60) return rtf.format(-m, "minute");
      const h = Math.round(m / 60);
      if (h < 24) return rtf.format(-h, "hour");
      const days = Math.round(h / 24);
      if (days < 30) return rtf.format(-days, "day");
      return dtf({ day: "numeric", month: "short" }).format(toDate(iso));
    },
    /** relative to now, either direction ("in 3 days") */
    relative: (value: number, unit: Intl.RelativeTimeFormatUnit) => rtf.format(value, unit),
    list: (items: string[]) => new Intl.ListFormat(tag, { style: "long", type: "conjunction" }).format(items),
  };
  return fmt;
}
export type AdminFormat = ReturnType<typeof makeFormat>;
