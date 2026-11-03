"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cx } from "@/lib/format";
import type { AdminLocale } from "@/lib/i18n/admin";
import { useT } from "./provider";

export { AdminI18nProvider, useT } from "./provider";

/** Props for any input/textarea that holds Arabic store content. */
export const arProps = { dir: "rtl", lang: "ar" } as const;
/** Props for numbers / prices / phones / codes / URLs that must stay LTR inside Arabic text. */
export const ltrProps = { dir: "ltr" } as const;

/** Inline LTR isolate for numbers, prices, phones, SKUs inside translated text. */
export function Ltr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}

/** Count filled Arabic fields: pass [englishValue, arabicValue] pairs; pairs whose English is empty are ignored. */
export function completeness(pairs: [unknown, unknown][]) {
  const filled = (v: unknown) => (Array.isArray(v) ? v.some((x) => typeof x === "string" && x.trim()) : typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().length > 0 : !!v);
  const relevant = pairs.filter(([en]) => filled(en));
  return { done: relevant.filter(([, ar]) => filled(ar)).length, total: relevant.length };
}

/** "ترجمة 8/10" pill — green when complete, amber when partial, neutral when nothing translated. */
export function TranslationMeter({ done, total, className, compact }: { done: number; total: number; className?: string; compact?: boolean }) {
  const { t } = useT();
  if (!total) return null;
  const full = done >= total;
  const pct = Math.round((done / total) * 100);
  return (
    <span
      title={full ? t("common.translation.complete") : t("common.translation.progress", { done, total })}
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset",
        full ? "bg-a-ok/12 text-a-ok ring-a-ok/20" : done ? "bg-a-warn/12 text-a-warn ring-a-warn/20" : "bg-a-ink/[0.06] text-a-dim ring-a-ink/[0.08]",
        className,
      )}
    >
      <span className="relative h-1 w-6 overflow-hidden rounded-full bg-current/20" aria-hidden>
        <motion.span className="absolute inset-y-0 start-0 rounded-full bg-current" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      </span>
      {compact ? (
        <bdi dir="ltr">
          {done}/{total}
        </bdi>
      ) : (
        t("common.translation.progress", { done, total })
      )}
    </span>
  );
}

/** Segmented English / العربية switch for editing store content in either language. */
export function ContentLangTabs({ value, onChange, arDone, arTotal, className }: { value: AdminLocale; onChange: (l: AdminLocale) => void; arDone?: number; arTotal?: number; className?: string }) {
  const id = useId();
  const opts: { v: AdminLocale; label: string }[] = [
    { v: "en", label: "English" },
    { v: "ar", label: "العربية" },
  ];
  return (
    <div role="tablist" className={cx("inline-flex h-8 items-center gap-0.5 rounded-lg border border-a-line bg-a-panel p-0.5", className)}>
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button key={o.v} type="button" role="tab" aria-selected={on} lang={o.v} onClick={() => onChange(o.v)} className={cx("relative flex h-full items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors", on ? "text-a-text" : "text-a-dim hover:text-a-text")}>
            {on ? <motion.span layoutId={`clt-${id}`} className="absolute inset-0 rounded-md bg-a-hover ring-1 ring-a-line-strong" transition={{ type: "spring", stiffness: 520, damping: 38 }} /> : null}
            <span className="relative">{o.label}</span>
            {o.v === "ar" && arTotal ? (
              <span className={cx("relative size-1.5 rounded-full", (arDone ?? 0) >= arTotal ? "bg-a-ok" : (arDone ?? 0) > 0 ? "bg-a-warn" : "bg-a-faint")} aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Small "AR" chip used next to field labels that edit Arabic content. */
export function ArChip({ className }: { className?: string }) {
  return <span lang="ar" className={cx("rounded bg-a-violet/15 px-1.5 py-px text-[10.5px] font-semibold text-a-accent", className)}>عربي</span>;
}
