import { ar } from "./ar";
import type { Locale } from "./config";
import { en, type Dict } from "./en";

/** Server-side dictionary lookup (client components get theirs from <I18nProvider>). */
export const getDict = (locale: Locale): Dict => (locale === "ar" ? ar : en);
