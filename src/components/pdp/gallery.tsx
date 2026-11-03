"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useIsRtl } from "@/components/fx/media";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";
import { actions, useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

/**
 * Mobile: full-bleed 4:5 scroll-snap carousel with dots.
 * Desktop: vertical thumbs + main image, height-capped to the viewport. Any image opens the zoom viewer.
 */
export function Gallery({ product: base, colorIdx }: { product: Product; colorIdx: number }) {
  const { d, t, product, color: colorLabel } = useI18n();
  const T = d.product.gallery;
  const p = product(base);
  // RTL: slides run right→left; Chrome reports scrollLeft as 0 at the start and negative toward the end
  const rtl = useIsRtl();
  const color = p.colors[colorIdx];
  const images = color.images;
  const [active, setActive] = useState(0);
  const [zoomAt, setZoomAt] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const wished = useStore((s) => s.wishlist.includes(p.id));
  const [copied, setCopied] = useState(false);

  // reset slide when the colour (and so the image set) changes
  const [lastColor, setLastColor] = useState(colorIdx);
  if (lastColor !== colorIdx) {
    setLastColor(colorIdx);
    setActive(0);
  }

  const goTo = (i: number) => {
    setActive(i);
    const el = track.current;
    if (el) el.scrollTo({ left: el.clientWidth * i * (rtl ? -1 : 1), behavior: "smooth" });
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, text: p.tagline, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        actions.toast({ title: T.linkCopied, body: p.title });
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };

  const alt = (i: number) => t(T.alt, { title: p.title, color: colorLabel(p, color.name), n: i + 1, total: images.length });

  return (
    <div className="relative lg:flex lg:justify-center lg:gap-4">
      {/* Desktop thumbs */}
      {images.length > 1 ? (
        <ul className="hidden w-[72px] shrink-0 flex-col gap-2.5 lg:flex" aria-label={T.images}>
          {images.map((src, i) => (
            <li key={src}>
              <button
                onClick={() => goTo(i)}
                aria-label={t(T.showImage, { n: i + 1 })}
                aria-current={i === active}
                className={cx("tap relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-well transition", i === active ? "ring-[1.5px] ring-ink ring-offset-2 ring-offset-bg" : "opacity-60 hover:opacity-100")}
              >
                <Image src={src} alt="" fill sizes="72px" loading="lazy" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative min-w-0 flex-1 lg:max-w-[calc((100dvh-var(--header-h)-48px)*0.8)]">
        <div
          key={colorIdx}
          ref={track}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain lg:rounded-[28px]"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
            if (i !== active) setActive(i);
          }}
          aria-roledescription="carousel"
          aria-label={t(T.carousel, { title: p.title })}
        >
          {images.map((src, i) => {
            const img = (
              <button onClick={() => setZoomAt(i)} className="relative block aspect-[4/5] w-full cursor-zoom-in bg-well" aria-label={t(T.zoomImage, { n: i + 1 })}>
                <Image
                  src={src}
                  alt={alt(i)}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  preload={i === 0}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                  quality={80}
                  className="object-cover"
                />
              </button>
            );
            return (
              <div key={src} className="w-full shrink-0 snap-center snap-always" aria-roledescription="slide" aria-label={t(T.slide, { n: i + 1, total: images.length })}>
                {img}
              </div>
            );
          })}
        </div>

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between lg:inset-x-4 lg:top-4">
          {p.badge ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold">
              <span className="size-1.5 rounded-full bg-forest" aria-hidden />
              {d.common.badge[p.badge]}
            </span>
          ) : (
            <span />
          )}
          <div className="pointer-events-auto flex flex-col gap-2">
            <button
              onClick={() => {
                actions.toggleWish(p.id);
                if (!wished) actions.toast({ title: d.product.card.savedToWishlist, body: p.title, image: images[0] });
              }}
              aria-pressed={wished}
              aria-label={wished ? T.removeWish : T.saveWish}
              className={cx("tap grid size-11 place-items-center rounded-full transition active:scale-90", wished ? "bg-ink text-white" : "bg-white/95 text-ink")}
            >
              <Icon name="heart" size={19} filled={wished} />
            </button>
            <button onClick={share} aria-label={T.share} className="tap grid size-11 place-items-center rounded-full bg-white/95 transition active:scale-90">
              <Icon name={copied ? "check" : "share"} size={18} />
            </button>
          </div>
        </div>

        {images.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-11 flex items-center justify-center gap-1.5 lg:hidden" aria-hidden>
            {images.map((_, i) => (
              <span key={i} className={cx("h-1.5 rounded-full transition-all duration-300", i === active ? "w-5 bg-ink" : "w-1.5 bg-ink/25")} />
            ))}
          </div>
        ) : null}
      </div>

      {zoomAt !== null ? <ZoomViewer images={images} start={zoomAt} alt={alt} rtl={rtl} T={T} onClose={() => setZoomAt(null)} /> : null}
    </div>
  );
}

/** Native <dialog>: focus trap + Esc for free. Tap an image to toggle 2.2× zoom at the tap point. */
function ZoomViewer({ images, start, alt, rtl, T, onClose }: { images: string[]; start: number; alt: (i: number) => string; rtl: boolean; T: ReturnType<typeof useI18n>["d"]["product"]["gallery"]; onClose: () => void }) {
  const [zoom, setZoom] = useState<{ i: number; x: number; y: number } | null>(null);
  const [idx, setIdx] = useState(start);

  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) {
          el.showModal();
          const track = el.querySelector<HTMLElement>("[data-track]");
          if (track) track.scrollLeft = track.clientWidth * start * (rtl ? -1 : 1);
        }
      }}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 backdrop:bg-ink/60"
      aria-label={T.viewer}
    >
      <div className="relative h-full">
        <div
          data-track
          className={cx("no-scrollbar flex h-full snap-x snap-mandatory", zoom ? "overflow-hidden" : "overflow-x-auto")}
          onScroll={(e) => setIdx(Math.round(Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth))}
        >
          {images.map((src, i) => {
            const z = zoom?.i === i ? zoom : null;
            return (
              <button
                key={src}
                className={cx("relative h-full w-full shrink-0 snap-center overflow-hidden", z ? "cursor-zoom-out" : "cursor-zoom-in")}
                aria-label={z ? T.zoomOut : T.zoomIn}
                onClick={(e) => {
                  if (z) return setZoom(null);
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom({ i, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                }}
              >
                <Image
                  src={src}
                  alt={alt(i)}
                  fill
                  sizes="100vw"
                  quality={80}
                  className="object-contain transition-transform duration-300 ease-[var(--ease-out-soft)]"
                  style={{ transform: z ? "scale(2.2)" : "scale(1)", transformOrigin: z ? `${z.x}% ${z.y}%` : "center" }}
                />
              </button>
            );
          })}
        </div>
        <button onClick={onClose} autoFocus aria-label={T.closeViewer} className="tap absolute inset-e-4 top-4 grid size-11 place-items-center rounded-full bg-ink text-white shadow-lift active:scale-90">
          <Icon name="close" size={20} />
        </button>
        <span className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-[12px] font-semibold text-white tabular-nums">
          <bdi dir="ltr">
            {idx + 1} / {images.length}
          </bdi>
        </span>
      </div>
    </dialog>
  );
}
