import { cookies } from "next/headers";
import { ADMIN_LANG_COOKIE, DEFAULT_ADMIN_LOCALE, isAdminLocale, makeFormat, type AdminLocale } from "./core";
import { makeT } from "./index";
import { legacyKey } from "@/lib/legacy-name";

/** Admin locale from the `vedra_admin_lang` cookie (default Arabic). Server components, actions and route handlers. */
export async function getAdminLocale(): Promise<AdminLocale> {
  const jar = await cookies();
  const v = jar.get(ADMIN_LANG_COOKIE)?.value ?? jar.get(legacyKey(ADMIN_LANG_COOKIE))?.value;
  return isAdminLocale(v) ? v : DEFAULT_ADMIN_LOCALE;
}

/** `const { t, fmt, locale } = await getT();` — use in server components and server actions (error messages). */
export async function getT() {
  const locale = await getAdminLocale();
  return { locale, t: makeT(locale), fmt: makeFormat(locale), dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const) };
}
