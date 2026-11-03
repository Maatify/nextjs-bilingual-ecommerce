/*
 * The i18n "kit" handed to components — same shape on the server (getI18n()) and the client (useI18n()).
 * Pure: the dictionary is passed in, so client bundles never import both languages.
 */
import type { Collection, Product } from "@/lib/types";
import { dirOf, fmt, formatDate, formatMoney, localeHref, plural, type Locale, type PluralForms, type Vars } from "./config";
import { categoryName, colorName, governorateName, localizeCollection, localizeProduct } from "./content";
import type { Dict } from "./en";

export function makeI18n(locale: Locale, d: Dict) {
  return {
    locale,
    dir: dirOf(locale),
    isAr: locale === "ar",
    /** the dictionary: d.cart.title, … */
    d,
    /** interpolate: t(d.cart.free, { n: 2 }) */
    t: (s: string, vars?: Vars) => fmt(s, vars),
    /** plural: p(d.cart.items, 3) */
    p: (forms: PluralForms | string, n: number, vars?: Vars) => plural(locale, forms, n, vars),
    money: (n: number) => formatMoney(n, locale),
    /** "/products/x" → "/ar/products/x" in Arabic */
    href: (h: string) => localeHref(locale, h),
    date: (v: Date | string, opts?: Intl.DateTimeFormatOptions) => formatDate(v, locale, opts),
    product: (p: Product) => localizeProduct(p, locale),
    collection: (c: Collection) => localizeCollection(c, locale),
    color: (p: Pick<Product, "ar"> | null | undefined, name: string) => colorName(p, name, locale),
    category: (p: Pick<Product, "ar" | "category">) => categoryName(p, locale),
    gov: (name: string) => governorateName(name, locale),
  };
}

export type I18n = ReturnType<typeof makeI18n>;
