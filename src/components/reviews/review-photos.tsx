"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { cx } from "@/lib/format";

/**
 * Customer photos on a review: a row of small thumbnails; each opens an accessible lightbox (focus-trapped sheet,
 * Esc closes, ←/→ step, focus returns to the thumbnail). `inert` copies (marquee duplicates) render plain images.
 */
export function ReviewPhotos({ photos, name, size = 56, inert, className }: { photos: string[]; name: string; size?: number; inert?: boolean; className?: string }) {
  const { d, t, isAr } = useI18n();
  const T = d.product.reviews;
  const [open, setOpen] = useState<number | null>(null);
  const reduce = useReducedMotion();
  // the lightbox is portalled to <body>: review cards sit inside transformed parents (tilt, marquee) that would trap position:fixed
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!photos.length) return null;
  const total = photos.length;
  const step = (dir: 1 | -1) => setOpen((i) => (i === null ? i : (i + dir + total) % total));

  return (
    <>
      <ul className={cx("flex gap-2", className)} aria-label={T.photos}>
        {photos.map((src, i) => (
          <li key={src}>
            {inert ? (
              <span className="relative block overflow-hidden rounded-xl bg-well" style={{ width: size, height: size }}>
                <Image src={src} alt="" fill sizes={`${size}px`} loading="lazy" className="object-cover" />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={t(T.openPhoto, { n: i + 1, total, name })}
                className="tap group relative block overflow-hidden rounded-xl bg-well ring-1 ring-ink/5 transition-shadow hover:ring-ink/25"
                style={{ width: size, height: size }}
              >
                <Image src={src} alt="" fill sizes={`${size}px`} loading="lazy" className="object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {inert || !mounted ? null : createPortal(
        <Sheet open={open !== null} onClose={() => setOpen(null)} title={t(T.viewer, { name })} side="center" width="md:max-w-[min(760px,92vw)]">
          <div
            className="flex flex-col items-center gap-3"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") step(isAr ? -1 : 1);
              if (e.key === "ArrowLeft") step(isAr ? 1 : -1);
            }}
          >
            <div className="relative aspect-square w-full max-w-[640px] overflow-hidden rounded-2xl bg-well">
              <AnimatePresence initial={false} mode="popLayout">
                {open !== null ? (
                  <motion.div key={photos[open]} className="absolute inset-0" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Image src={photos[open]} alt={t(T.photoFrom, { name })} fill sizes="(min-width: 768px) 640px, 92vw" className="object-contain" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            {total > 1 ? (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => step(-1)} aria-label={T.prev} className="tap grid size-11 place-items-center rounded-full bg-surface-2 transition hover:bg-ink/10">
                  <Icon name="chevronLeft" size={18} className="rtl:-scale-x-100" />
                </button>
                <span className="min-w-12 text-center text-[13px] tabular-nums text-muted" aria-live="polite">
                  <bdi dir="ltr">{t(T.counter, { n: (open ?? 0) + 1, total })}</bdi>
                </span>
                <button type="button" onClick={() => step(1)} aria-label={T.next} className="tap grid size-11 place-items-center rounded-full bg-surface-2 transition hover:bg-ink/10">
                  <Icon name="chevronRight" size={18} className="rtl:-scale-x-100" />
                </button>
              </div>
            ) : null}
          </div>
        </Sheet>,
        document.body,
      )}
    </>
  );
}

const noop = () => () => {};
