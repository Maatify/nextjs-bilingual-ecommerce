"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useFx, useIsRtl } from "@/components/fx/media";
import { useFirstOpen } from "@/components/fx/page-transition";
import { Tilt3D } from "@/components/fx/tilt";
import { OfferChip } from "@/components/ui/offer-chip";
import { cx } from "@/lib/format";

export interface HeroShot {
  src: string;
  alt: string;
  /** set only for real best sellers */
  rank?: number;
  title?: string;
  price?: string;
  href?: string;
  /** red offer chip, e.g. "16% OFF" / "2 × 20% OFF" */
  offer?: string;
}

const SIZES = "(min-width: 1440px) 380px, (min-width: 768px) 24vw, 42vw";
const SIZES_FEATURED = "(min-width: 1440px) 460px, (min-width: 768px) 29vw, 52vw";

/* gold / silver / bronze-tinted glass chips */
const MEDAL = [
  "bg-[linear-gradient(135deg,rgb(255_236_170/0.95),rgb(243_207_91/0.92))] text-[#3d2f05] ring-[#f3cf5b]/60",
  "bg-[linear-gradient(135deg,rgb(250_250_252/0.95),rgb(208_212_220/0.92))] text-[#2a2e36] ring-white/70",
  "bg-[linear-gradient(135deg,rgb(250_222_196/0.95),rgb(214_160_118/0.92))] text-[#3b2212] ring-[#d6a076]/60",
];

/**
 * Hero photo collage. With real best sellers: #1 is featured (bigger), each photo is a link with a
 * rank chip, name, price and "Shop ↗" on hover, and tilts in 3D. The first image is the LCP image:
 * preloaded, never hidden behind opacity — the load-in is a CSS saturation bloom (filter/transform only).
 */
/** Depth parallax: each photo drifts with the pointer by its own depth (nearer = more). */
function Layer({ mx, my, depth, className, children }: { mx: MotionValue<number>; my: MotionValue<number>; depth: number; className?: string; children: React.ReactNode }) {
  // pointer-relative drift: physical x, so it follows the cursor the same way in both directions
  const x = useTransform(mx, (v) => v * depth * 18);
  const y = useTransform(my, (v) => v * depth * 12);
  return (
    <motion.li className={className} style={{ x, y }}>
      {children}
    </motion.li>
  );
}

const DEPTHS = [1, -0.55, 0.7];

export function HeroCollage({ shots, shopLabel = "Shop" }: { shots: HeroShot[]; shopLabel?: string }) {
  const ranked = shots.some((s) => s.rank);
  const on = useFx();
  // load-in bloom only the first time home is opened this session
  const bloom = useFirstOpen();
  const rtl = useIsRtl();
  const spring = { stiffness: 120, damping: 20, mass: 0.6 };
  const mx = useSpring(useMotionValue(0), spring);
  const my = useSpring(useMotionValue(0), spring);
  return (
    <ul
      className={cx("grid gap-2 md:gap-3", ranked ? "grid-cols-[1.2fr_1fr] md:grid-cols-[1.3fr_1fr_1fr] md:items-end" : "grid-cols-2 md:grid-cols-3")}
      onPointerMove={(e) => {
        if (!on || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {shots.map((s, i) => {
        const featured = ranked && i === 0;
        const photo = (
          <div className={cx(bloom && "fx-bloom", "relative overflow-hidden rounded-[20px] bg-well", featured ? "h-full min-h-[240px] md:aspect-[4/5] md:h-auto" : "aspect-[4/5]")} style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
            <Image
              src={s.src}
              alt={s.alt}
              fill
              preload={i === 0}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              sizes={featured ? SIZES_FEATURED : SIZES}
              className={cx("object-cover", s.href && "transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]")}
            />
            {s.href && s.title ? <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/15 to-transparent" /> : null}
            {s.offer ? (
              <span className={cx("pointer-events-none absolute end-2.5 z-[6] flex", s.rank ? "start-2.5 top-12 md:start-3 md:top-14" : "start-2.5 top-2.5 md:start-3 md:top-3")}>
                <OfferChip wrap>{s.offer}</OfferChip>
              </span>
            ) : null}
          </div>
        );
        // offer chip: end-2.5 + wrap — the long Arabic multi-buy chip ("خصم 20% على قطعتين") was clipped by the narrow tablet photo.
        // links are named by their content (photo alt + rank/title/price + offer chip) — an aria-label would hide that visible text (WCAG 2.5.3)
        return (
          <Layer key={`${s.src}-${i}`} mx={mx} my={my} depth={DEPTHS[i] ?? 0.5} className={cx(!ranked && i === 2 && "hidden md:block", featured && "row-span-2 md:row-span-1")}>
            {s.href ? (
              <Link href={s.href} className="group block h-full rounded-[20px]">
                <Tilt3D max={7} scale={1.02} className="h-full rounded-[20px]">
                  {photo}
                  {s.rank ? (
                    <span
                      className={cx("absolute start-2.5 top-2.5 z-[5] inline-flex h-8 items-center rounded-full px-3 font-poster text-[17px] leading-none shadow-[0_8px_20px_-8px_rgb(16_19_16/0.5)] ring-1 md:start-3 md:top-3", featured && "h-9 px-3.5 text-[20px]", MEDAL[s.rank - 1] ?? MEDAL[2])}
                      style={{ "--z": "40px" } as React.CSSProperties} data-z
                    >
                      <bdi dir="ltr">#{s.rank}</bdi>
                    </span>
                  ) : null}
                  {s.title ? (
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 z-[5] flex items-end justify-between gap-2 text-white" style={{ "--z": "26px" } as React.CSSProperties} data-z>
                    <span className="min-w-0">
                      <span className={cx("block truncate font-semibold leading-tight", featured ? "text-[14px] md:text-[16px]" : "text-[12.5px] md:text-[14px]")}>{s.title}</span>
                      <span className="block text-[12px] tabular-nums text-white/85 md:text-[13px]">{s.price}</span>
                    </span>
                    <span className="hidden h-8 shrink-0 translate-y-1 items-center gap-1 rounded-full bg-white px-3 text-[12.5px] font-semibold text-ink opacity-0 transition duration-300 ease-[var(--ease-out-soft)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 md:inline-flex">
                      {shopLabel} <span aria-hidden>{rtl ? "↖" : "↗"}</span>
                    </span>
                  </span>
                  ) : null}
                </Tilt3D>
              </Link>
            ) : (
              photo
            )}
          </Layer>
        );
      })}
    </ul>
  );
}
