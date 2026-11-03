"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { ADMIN_LANG_COOKIE, dirOf, makeFormat, makeT, type AdminFormat, type AdminLocale, type TFn } from "@/lib/i18n/admin";

type Ctx = {
  locale: AdminLocale;
  dir: "rtl" | "ltr";
  isRtl: boolean;
  t: TFn;
  fmt: AdminFormat;
  setLocale: (l: AdminLocale) => void;
  switching: boolean;
};

const I18nCtx = createContext<Ctx | null>(null);

type VTDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

/**
 * Mounted once by src/app/admin/layout.tsx with the cookie locale. Switching writes the cookie and
 * refreshes the server tree inside a View Transition that only resolves once the new locale has
 * rendered — so the whole page crossfades from one language to the other (no mixed-language frame).
 */
export function AdminI18nProvider({ locale, children }: { locale: AdminLocale; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<AdminLocale | null>(null);
  const done = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    // the server tree for the new locale has committed
    done.current?.();
    done.current = null;
  }, [locale]);

  const setLocale = useCallback(
    (next: AdminLocale) => {
      if (next === locale) return;
      document.cookie = `${ADMIN_LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      setTarget(next);
      const refresh = () => startTransition(() => router.refresh());
      const doc = document as VTDoc;
      if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return refresh();
      const root = document.documentElement;
      root.classList.add("a-lang-vt");
      const vt = doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            done.current = resolve;
            refresh();
            setTimeout(resolve, 3000); // never freeze the page if the refresh stalls
          }),
      );
      vt.finished.finally(() => root.classList.remove("a-lang-vt"));
    },
    [locale, router],
  );

  const value = useMemo<Ctx>(
    () => ({ locale, dir: dirOf(locale), isRtl: locale === "ar", t: makeT(locale), fmt: makeFormat(locale), setLocale, switching: pending && target !== null && target !== locale }),
    [locale, setLocale, pending, target],
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

const FALLBACK: Ctx = { locale: "en", dir: "ltr", isRtl: false, t: makeT("en"), fmt: makeFormat("en"), setLocale: () => {}, switching: false };

/** `const { t, fmt, locale, isRtl } = useT();` — client components under /admin. */
export function useT(): Ctx {
  return useContext(I18nCtx) ?? FALLBACK;
}
