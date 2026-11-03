"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cx, money, pctOff } from "@/lib/format";
import type { AdminLocale } from "@/lib/i18n/admin";
import type { Product } from "@/lib/types";
import { useT } from "../i18n";

const MAX_SWATCHES = 5;

/** Live mimic of the storefront collection card — updates as the draft changes. */
/** Live mimic of the storefront card. `lang` renders the Arabic store version (Arabic copy with English fallback). */
export function ProductCardPreview({ product: p, lang = "en" }: { product: Product; lang?: AdminLocale }) {
  const { t } = useT();
  const isAr = lang === "ar";
  const title = isAr ? p.ar?.title || p.title : p.title;
  const tagline = isAr ? p.ar?.tagline || p.tagline : p.tagline;
  const colorName = (n: string) => (isAr ? p.ar?.colors?.[n] || n : n);
  const [idx, setIdx] = useState(0);
  const i = Math.min(idx, Math.max(0, p.colors.length - 1));
  const color = p.colors[i];
  const src = color?.images[0];
  const off = pctOff(p.price, p.compareAt);
  const soldOut = p.sizes.length > 0 && p.sizes.every((s) => !s.stock);
  const extra = p.colors.length - MAX_SWATCHES;

  return (
    <div dir={isAr ? "rtl" : "ltr"} lang={lang} className="rounded-xl bg-[#fafaf8] p-3 text-start text-[#16181d]">
      <div className="relative overflow-hidden rounded-[18px] bg-[#f1f1ee]">
        <div className="relative aspect-[4/5]">
          <AnimatePresence initial={false} mode="popLayout">
            {src ? (
              <motion.div key={src} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="absolute inset-0">
                <Image src={src} alt={t("products.card.imageAlt", { title: title || t("products.seo.product"), color: colorName(color?.name ?? "") })} fill sizes="300px" className="object-cover" />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 grid place-items-center text-[12px] text-black/35">
                {t("products.card.noImage")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {off || p.badge ? (
          <span className="absolute start-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
            <span className={cx("size-1.5 rounded-full", off ? "bg-[#c2410c]" : "bg-[#1f3d2b]")} aria-hidden />
            {off ? <bdi dir="ltr">−{off}%</bdi> : isAr && p.badge ? ({ Bestseller: "الأكثر مبيعًا", New: "جديد", Limited: "كمية محدودة", "Online exclusive": "حصري أونلاين" } as const)[p.badge] : p.badge}
          </span>
        ) : null}
        <span className="absolute end-2 top-2 grid size-8 place-items-center rounded-full bg-white/90" aria-hidden>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
          </svg>
        </span>
      </div>
      <div className="pt-3">
        <p className="truncate text-[15px] font-semibold leading-tight">{title || t("products.card.untitled")}</p>
        <p className="mt-1 text-[14px] font-semibold tabular-nums">
          <span className={off ? "text-[#c2410c]" : ""}>{money(p.price || 0)}</span>
          {p.compareAt ? <s className="ms-1.5 text-[12px] font-medium text-black/45">{money(p.compareAt)}</s> : null}
        </p>
        {p.colors.length > 1 ? (
          <div className="-ms-1 mt-1.5 flex items-center" role="radiogroup" aria-label={t("products.card.previewColour")}>
            {p.colors.slice(0, MAX_SWATCHES).map((c, j) => (
              <button key={c.name + j} type="button" role="radio" aria-checked={j === i} aria-label={colorName(c.name)} onClick={() => setIdx(j)} className="grid size-6 place-items-center rounded-full">
                <span className={cx("rounded-full transition-all", j === i ? "size-3.5 ring-[1.5px] ring-[#16181d] ring-offset-2 ring-offset-[#fafaf8]" : "size-3 ring-1 ring-black/15")} style={{ background: c.hex }} />
              </button>
            ))}
            {extra > 0 ? <span className="ps-0.5 text-[11px] font-medium text-black/45">+{extra}</span> : null}
          </div>
        ) : null}
        {tagline ? <p className="mt-1 truncate text-[12.5px] text-black/55">{tagline}</p> : null}
        <span className={cx("mt-3 flex h-10 w-full items-center justify-center rounded-full text-[13px] font-semibold text-white", soldOut ? "bg-black/30" : "bg-[#16181d]")}>{isAr ? (soldOut ? "نفدت الكمية" : "أضف إلى الحقيبة") : soldOut ? "Sold out" : "Add to bag"}</span>
      </div>
    </div>
  );
}
