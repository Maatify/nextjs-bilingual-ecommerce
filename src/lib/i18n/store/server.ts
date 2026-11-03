/*
 * Server-component access to the storefront language. The locale is the [lang] root param
 * (src/app/[lang]/layout.tsx), so any Server Component under it can call getLocale()/getI18n()
 * without prop drilling. Not available in route handlers / server actions (they always work in English).
 */
import { lang } from "next/root-params";
import { asLocale, type Locale } from "./config";
import { getDict } from "./dict";
import { makeI18n } from "./kit";

export async function getLocale(): Promise<Locale> {
  try {
    return asLocale(await lang());
  } catch {
    return "en";
  }
}

/** { locale, d, t, p, money, href, product, collection, color, … } for the current request's language. */
export async function getI18n() {
  const locale = await getLocale();
  return makeI18n(locale, getDict(locale));
}

export { getDict };
