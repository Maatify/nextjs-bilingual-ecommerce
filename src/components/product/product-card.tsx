"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useState } from "react";
import { Tilt3D } from "@/components/fx/tilt";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { OfferChip, pctOffLabel } from "@/components/ui/offer-chip";
import { multiBuy } from "@/lib/pricing";
import { Sheet } from "@/components/ui/sheet";
import { priceRange, variantPrice, withColorStock } from "@/lib/catalog";
import { cx, pctOff } from "@/lib/format";
import { actions, useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

const MAX_SWATCHES = 5;

/**
 * Collection card (Linea pattern): soft image well, one badge max, name,
 * swatches + price on one line, one-line tagline, full-width "Add to bag" pill.
 * Swatches swap the image in place; hover reveals the flat/back shot.
 */
export function ProductCard({
  product: base,
  priority,
  rank,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
}: {
  product: Product;
  priority?: boolean;
  rank?: number;
  sizes?: string;
}) {
  const { d, t, money, isAr, product, color: colorLabel } = useI18n();
  const T = d.product.card;
  // display copy in the page language; ids, colour names and sizes stay the English keys
  const p = product(base);
  const [colorIdx, setColorIdx] = useState(0);
  const [picking, setPicking] = useState(false);
  const wished = useStore((s) => s.wishlist.includes(p.id));
  const color = p.colors[colorIdx];
  const cname = colorLabel(p, color.name);
  const off = pctOff(p.price, p.compareAt);
  // products without a sale price show the multi-buy offer instead: "2 × 20% OFF" / "خصم 20% لقطعتين"
  const mb = multiBuy();
  const multiChip = mb ? (isAr ? `خصم ${mb.pct}% ${mb.qty === 2 ? "لقطعتين" : `على ${mb.qty} ${mb.qty > 10 ? "قطعة" : "قطع"}`}` : `${mb.qty}\u202F×\u202F${mb.pct}% OFF`) : "";
  // availability for the colour on show (stock lives on colour × size variants)
  const pc = withColorStock(p, color.name);
  const soldOut = pc.sizes.every((s) => s.stock === 0);
  const oneSize = p.sizes.length === 1;
  const range = priceRange(p, color.name);
  const href = `/products/${p.handle}${colorIdx ? `?color=${encodeURIComponent(color.name)}` : ""}`;
  const extra = p.colors.length - MAX_SWATCHES;

  const add = (size: string) => {
    actions.add({ productId: p.id, color: color.name, size });
    setPicking(false);
  };

  return (
    <article className="@container group relative flex min-w-0 flex-col">
      {/* 3D tilt + glare on hover (desktop pointers only); badge + wishlist float above the photo in depth */}
      <Tilt3D max={7} scale={1.02} className="rounded-[20px] md:rounded-[24px]">
      <div className="fx-sat relative overflow-hidden rounded-[20px] bg-well md:rounded-[24px]">
        <Link href={href} className="block" aria-label={t(T.linkLabel, { title: p.title, color: cname })}>
            <div className="relative aspect-[4/5]">
              <Image
                src={color.images[0]}
                alt={t(T.imageAlt, { title: p.title, color: cname })}
                fill
                sizes={sizes}
                preload={priority}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : undefined}
                className={cx("object-cover transition-[transform,opacity] duration-700 ease-[var(--ease-out-soft)] md:group-hover:scale-[1.02]", color.images[1] && "md:group-hover:opacity-0")}
              />
              {color.images[1] ? (
                <Image src={color.images[1]} alt="" fill sizes={sizes} loading="lazy" className="hidden object-cover opacity-0 transition-opacity duration-500 md:block md:group-hover:opacity-100" />
              ) : null}
            </div>
        </Link>
      </div>

        {/* top-start stack: the % chip on EVERY card (real sale % when there is one, otherwise the live multi-buy
            offer, which genuinely applies to every piece) + the rank / badge pill under it */}
        <span style={{ "--z": "34px" } as React.CSSProperties} className="tilt-z pointer-events-none absolute inset-e-11 inset-s-2.5 top-3 z-[5] flex flex-col items-start gap-1.5 md:inset-s-3 md:top-3.5">
          {/* inset-e-11 keeps the stack clear of the wishlist heart. "2 × 20% OFF" stays on one line (a smaller chip on narrow
              phone cards); only the wider Arabic "خصم 20% لقطعتين" may wrap instead of running under the heart */}
          {off ? (
            <OfferChip>{pctOffLabel(off, isAr ? "ar" : "en")}</OfferChip>
          ) : multiChip ? (
            <OfferChip wrap={isAr} className="@max-[10.5rem]:px-1.5 @max-[10.5rem]:text-[11px] @max-[10.5rem]:tracking-[0.03em]">{multiChip}</OfferChip>
          ) : null}
          {p.badge || rank ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold">
              <span className="size-1.5 rounded-full bg-forest" aria-hidden />
              {rank ? <bdi dir="ltr">#{rank}</bdi> : p.badge ? d.common.badge[p.badge] : null}
            </span>
          ) : null}
        </span>

        <button
          onClick={() => {
            actions.toggleWish(p.id);
            if (!wished) actions.toast({ title: T.savedToWishlist, body: p.title, image: color.images[0] });
          }}
          aria-pressed={wished}
          aria-label={t(wished ? T.removeWish : T.saveWish, { title: p.title })}
          style={{ "--z": "40px" } as React.CSSProperties}
          className="tilt-z tap absolute inset-e-1 top-1 z-[5] grid size-11 place-items-center rounded-full transition active:scale-90 md:inset-e-1.5 md:top-1.5"
        >
          <span className="grid size-8 place-items-center rounded-full bg-white/95">
            <Icon name="heart" size={15} filled={wished} className={cx("transition-transform", wished && "scale-110 text-sale")} />
          </span>
        </button>
      </Tilt3D>

      <div className="flex flex-1 flex-col pt-3">
        <Link href={href} className="truncate text-[14px] font-semibold leading-tight md:text-[16px]">
          {p.title}
        </Link>

        <p className="mt-1 text-[14px] font-semibold tabular-nums md:text-[15px]">
          {range.min !== range.max ? <span className="me-1 text-[12px] font-medium text-muted">{T.from}</span> : null}
          <span className={off ? "text-sale" : ""}>{money(range.min)}</span>
          {p.compareAt ? <s className="ms-1.5 text-[12px] font-medium text-muted">{money(p.compareAt)}</s> : null}
        </p>

        {p.colors.length > 1 ? (
          <div className="-ms-1 mt-1.5 flex min-w-0 items-center" role="radiogroup" aria-label={T.colour}>
            {p.colors.slice(0, MAX_SWATCHES).map((c, i) => (
              <button
                key={c.name}
                role="radio"
                aria-checked={i === colorIdx}
                aria-label={colorLabel(p, c.name)}
                onClick={() => setColorIdx(i)}
                className="tap grid size-6 shrink-0 place-items-center rounded-full"
              >
                <span
                  className={cx("rounded-full transition-all", i === colorIdx ? "size-3.5 ring-[1.5px] ring-ink ring-offset-2 ring-offset-bg" : "size-3 ring-1 ring-ink/15")}
                  style={{ background: c.hex }}
                />
              </button>
            ))}
            {extra > 0 ? (
              <span className="ps-0.5 text-[12px] font-medium text-muted">
                <bdi dir="ltr">+{extra}</bdi>
              </span>
            ) : null}
          </div>
        ) : null}

        <p className="mt-1 hidden truncate text-[13px] text-muted sm:block">{p.tagline}</p>

        <button
          disabled={soldOut}
          onClick={() => (oneSize ? add(p.sizes[0].label) : setPicking(true))}
          className="tap fx-press relative mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] font-semibold text-white transition hover:bg-forest disabled:bg-ink/30 md:h-11 md:text-[14px]"
        >
          {soldOut ? (p.colors.length > 1 && p.sizes.some((s) => s.stock > 0) ? t(T.soldOutIn, { color: cname }) : T.soldOut) : T.addToBag}
          {!soldOut ? <Icon name="arrowUpRight" size={15} /> : null}
        </button>
      </div>

      {!oneSize ? (
        <Sheet open={picking} onClose={() => setPicking(false)} title={T.pickSize} side="center" width="max-w-[480px]">
          <div className="mb-5 flex items-center gap-3">
            <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-well">
              <Image src={color.images[0]} alt="" fill sizes="64px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{p.title}</span>
              <span className="text-[13px] text-muted">
                {cname} · {range.min !== range.max ? t(T.fromPrice, { price: money(range.min) }) : money(range.min)}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 pb-2">
            {pc.sizes.map((s) => (
              <button
                key={s.label}
                disabled={!s.stock}
                aria-label={`${s.label}${!s.stock ? T.sizeSoldOut : s.stock <= 3 ? t(T.sizeOnlyLeft, { n: s.stock }) : ""}${variantPrice(p, color.name, s.label).price !== p.price ? `${isAr ? "، " : ", "}${money(variantPrice(p, color.name, s.label).price)}` : ""}`}
                onClick={() => add(s.label)}
                className="tap relative h-12 overflow-hidden rounded-full bg-surface-2 text-[14px] font-semibold ring-1 ring-line transition hover:bg-ink hover:text-white active:scale-95 disabled:text-muted disabled:line-through disabled:hover:bg-surface-2"
              >
                {s.label}
                {s.stock > 0 && s.stock <= 3 ? <span className="absolute inset-e-2.5 top-1.5 size-1.5 rounded-full bg-sale" aria-label={t(T.left, { n: s.stock })} /> : null}
              </button>
            ))}
          </div>
          <Link href={`/products/${p.handle}`} className="mt-3 block text-center text-[13px] font-medium text-ink-2 underline underline-offset-4">
            {T.notSure}
          </Link>
        </Sheet>
      ) : null}
    </article>
  );
}
