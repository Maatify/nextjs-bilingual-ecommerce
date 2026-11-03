"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "@/lib/format";
import type { HomeContent, NavLink } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { ease } from "../ui";
import type { ProductOption } from "./types";

/*
 * Light-theme previews that mimic the storefront (cream/ink palette, poster type)
 * so admins see roughly what customers will see without leaving the editor.
 */

function Tape({ items, reverse, className, lang }: { items: string[]; reverse?: boolean; className?: string; lang?: "ar" }) {
  const { t } = useT();
  const list = items.length ? items : [t("content.preview.addPhrase")];
  const half = [...list, ...list];
  return (
    // marquee runs LTR internally in both languages; Arabic phrases keep their own shaping via lang
    <div dir="ltr" lang={lang} className={cx("absolute left-[-8%] w-[116%] overflow-hidden py-2", className)}>
      <div className={cx("flex w-max motion-reduce:animate-none", reverse ? "animate-ribbon-rev" : "animate-ribbon")}>
        {[0, 1].map((k) => (
          <ul key={k} className="flex shrink-0 items-center" aria-hidden>
            {half.map((t, i) => (
              <li key={i} className="flex items-center gap-3 whitespace-nowrap pr-3 font-poster text-[15px] leading-none">
                <span className="text-[0.85em]">✱</span>
                {t}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/** Two crossed marquee tapes, same colours/angles as the storefront component. */
export function RibbonsPreview({ a, b, lang }: { a: string[]; b: string[]; lang?: "ar" }) {
  const { t } = useT();
  return (
    <div className="relative h-[120px] overflow-hidden rounded-xl bg-[#ecede8]" role="img" aria-label={t("content.preview.ribbon", { list: [...a, ...b].join("، ") })}>
      <Tape items={b} lang={lang} reverse className="top-1/2 -translate-y-1/2 rotate-[2.5deg] bg-[#a8b699] text-[#101310]" />
      <Tape items={a} lang={lang} className="top-1/2 -translate-y-1/2 -rotate-[3.5deg] bg-[#101310] text-white shadow-[0_18px_40px_-16px_rgb(16_19_16/0.5)]" />
    </div>
  );
}

/** Announcement bar marquee, as it runs above the storefront header. */
export function AnnouncementPreview({ items, nav, lang }: { items: NavLink[]; nav?: NavLink[]; lang?: "ar" }) {
  const { t } = useT();
  const list = items.filter((i) => i.label.trim());
  const row = list.length ? [...list, ...list, ...list] : [];
  return (
    <div className="overflow-hidden rounded-xl bg-[#ecede8] ring-1 ring-black/5" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="h-8 overflow-hidden bg-[#101310] text-white" dir="ltr">
        {row.length ? (
          <div className="flex h-full w-max animate-marquee items-center motion-reduce:animate-none">
            {[0, 1].map((k) => (
              <ul key={k} className="flex shrink-0 items-center" aria-hidden={k === 1 || undefined}>
                {row.map((m, i) => (
                  <li key={i} className="flex items-center gap-6 whitespace-nowrap pe-6 text-[11.5px] font-medium tracking-[0.02em]">
                    <span className={cx(m.href && "underline decoration-white/30 underline-offset-2")}>{m.label}</span>
                    <span className="text-white/40">✱</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ) : (
          <p className="grid h-full place-items-center text-[11.5px] text-white/50" dir="auto">{t("content.preview.announcementHidden")}</p>
        )}
      </div>
      {nav ? (
        <div className="flex items-center gap-4 bg-white px-4 py-3 text-[#101310]">
          <span className="font-poster text-[18px] leading-none">VERDA</span>
          <ul className="flex min-w-0 flex-1 items-center gap-3.5 overflow-hidden">
            <AnimatePresence initial={false}>
              {nav.map((l, i) => (
                <motion.li layout key={`${l.label}-${i}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }} className="whitespace-nowrap text-[12px] font-medium text-[#3a3f39]">
                  {l.label || "—"}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <span className="flex items-center gap-2 text-[#3a3f39]">
            <AIcon name="search" size={15} />
            <AIcon name="orders" size={15} />
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Mini storefront hero: eyebrow, poster title, subtitle, pill CTAs, photo row. */
export function HeroPreview({ hero, featured, lang }: { hero: HomeContent["hero"]; featured?: ProductOption; lang?: "ar" }) {
  const { t } = useT();
  const lines = (hero.title || t("content.preview.headline")).split(/\n/);
  const shots = hero.images.filter(Boolean).slice(0, 3);
  return (
    <div className="overflow-hidden rounded-2xl bg-[#ecede8] p-2.5 text-[#101310]" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="rounded-[18px] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          {hero.eyebrow ? (
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium">
              <span className="size-1.5 rounded-full bg-[#2e7a4a]" />
              {hero.eyebrow}
            </span>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-[#5f645d]" dir="ltr">★★★★★ 4.8</span>
        </div>
        <h3 className={cx("mt-3 break-words font-poster text-[34px]", lang === "ar" ? "font-bold leading-[1.15]" : "leading-[0.9]")}>
          {lines.map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </h3>
        {hero.subtitle ? <p className="mt-2.5 max-w-[30ch] text-[11.5px] leading-relaxed text-[#3a3f39]">{hero.subtitle}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hero.primary.label ? <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[#101310] px-3 text-[11px] font-medium text-white">{hero.primary.label} <span className="rtl:-scale-x-100">↗</span></span> : null}
          {hero.secondary.label ? <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[#f5f5f1] px-3 text-[11px] font-medium">{hero.secondary.label} <span className="rtl:-scale-x-100">↗</span></span> : null}
        </div>
        <div className="relative mt-3">
          <ul className="grid grid-cols-3 gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {shots.map((src, i) => (
                <motion.li layout key={src} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.25, ease }} className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-[#f1f1ee]">
                  <Image src={src} alt="" fill sizes="110px" className="object-cover" />
                  {i === 0 ? <span className="absolute start-1 top-1 rounded bg-black/60 px-1 text-[8.5px] font-semibold text-white">LCP</span> : null}
                </motion.li>
              ))}
            </AnimatePresence>
            {shots.length === 0 ? <li className="col-span-3 grid aspect-[3/1] place-items-center rounded-[10px] bg-[#f1f1ee] text-[11px] text-[#5f645d]">{t("content.preview.noHeroImages")}</li> : null}
          </ul>
          {featured ? (
            <div className="absolute -bottom-1 end-1 flex items-center gap-1.5 rounded-lg bg-white/95 p-1 pe-2 shadow-[0_8px_20px_-8px_rgb(16_19_16/0.35)]">
              <span className="relative size-7 overflow-hidden rounded-md bg-[#f1f1ee]">{featured.image ? <Image src={featured.image} alt="" fill sizes="28px" className="object-cover" /> : null}</span>
              <span className="leading-tight">
                <span className="block max-w-[100px] truncate text-[9.5px] font-semibold">{featured.title}</span>
                <bdi dir="ltr" className="block text-start text-[9px] text-[#5f645d]">EGP {featured.price.toLocaleString("en")}</bdi>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
