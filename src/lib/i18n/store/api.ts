/*
 * Language for storefront API route handlers (they can't read the [lang] root param).
 * Clients send `x-verda-lang`; otherwise the same-origin Referer (/ar/…) decides; default English.
 * Responses stay byte-for-byte English unless the shopper is on the Arabic storefront.
 */
import { asLocale, stripLocale, type Locale } from "./config";

export const LANG_HEADER = "x-verda-lang";

export function requestLocale(req: Request): Locale {
  const h = req.headers.get(LANG_HEADER);
  if (h) return asLocale(h);
  const q = new URL(req.url).searchParams.get("lang");
  if (q) return asLocale(q);
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      return stripLocale(new URL(ref).pathname).locale;
    } catch {}
  }
  return "en";
}

/** `const L = msg(locale); bad(L("Enter your name", "اكتب اسمك"))` */
export const msg = (locale: Locale) => (en: string, ar: string) => (locale === "ar" ? ar : en);

/** Header to send from storefront fetches. */
export const langHeaders = (locale: Locale): Record<string, string> => ({ [LANG_HEADER]: locale });
