"use client";

import { motion } from "motion/react";
import { cx } from "@/lib/format";
import { ADMIN_LOCALES } from "@/lib/i18n/admin";
import { useT } from "./provider";

/** عربي / English segmented switch (top bar + login). Crossfades the whole dashboard on change. */
export function LangSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t, switching } = useT();
  return (
    <div role="radiogroup" aria-label={t("shell.lang.label")} aria-busy={switching || undefined} className={cx("relative flex h-8 items-center gap-0.5 rounded-lg border border-a-line bg-a-panel p-0.5", className)}>
      {ADMIN_LOCALES.map((l) => {
        const on = locale === l;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={on}
            lang={l}
            onClick={() => setLocale(l)}
            className={cx("fx-press relative grid h-full place-items-center rounded-md px-2 text-[12px] font-medium transition-colors", on ? "text-a-text" : "text-a-faint hover:text-a-text")}
          >
            {on ? <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-md bg-a-hover shadow-[0_2px_8px_-4px_var(--a-shadow)] ring-1 ring-a-line-strong" transition={{ type: "spring", stiffness: 520, damping: 36 }} /> : null}
            <span className="relative">{l === "ar" ? "عربي" : "EN"}</span>
          </button>
        );
      })}
    </div>
  );
}
