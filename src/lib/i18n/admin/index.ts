import { translate, type AdminLocale, type Paths, type Vars } from "./core";
import { ar } from "./ar";
import { en, type AdminDict } from "./en";

export * from "./core";
export type { AdminDict };
export type AdminKey = Paths<AdminDict>;
export type TFn = (key: AdminKey, vars?: Vars) => string;

export const dictionaries = { en, ar } as const;

/** A t() bound to a locale. Missing Arabic keys fall back to English. */
export function makeT(locale: AdminLocale): TFn {
  const dict = dictionaries[locale];
  return (key, vars) => translate(dict, en, locale, key, vars);
}
