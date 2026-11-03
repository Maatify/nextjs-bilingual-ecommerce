"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/store/config";
import type { Dict } from "@/lib/i18n/store/en";
import { makeI18n, type I18n } from "@/lib/i18n/store/kit";

const Ctx = createContext<{ locale: Locale; dict: Dict } | null>(null);

/** Hands the storefront language + its dictionary to client components (rendered by app/[lang]/layout.tsx). */
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** { locale, d, t, p, money, href, product, collection, color, gov, … } — see src/lib/i18n/store/kit.ts */
export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("[verda] useI18n() outside <I18nProvider>");
  return useMemo(() => makeI18n(v.locale, v.dict), [v]);
}

export const useLocale = (): Locale => useContext(Ctx)?.locale ?? "en";
