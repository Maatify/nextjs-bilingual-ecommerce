"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { buttonClass, ButtonLink, Price, Stars } from "@/components/ui/primitives";
import { colorStock, getProductById, productsIn, withColorStock } from "@/lib/catalog";
import { cx } from "@/lib/format";
import { actions, useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { ProductGrid } from "./product-grid";

export function WishlistView() {
  const { d, p: plural } = useI18n();
  const T = d.collection.wishlist;
  const ids = useStore((s) => s.wishlist);
  const hydrated = useStore((s) => s.hydrated);
  const items = useMemo(() => ids.map((id) => getProductById(id)).filter((p): p is Product => !!p), [ids]);

  if (!hydrated) return <div className="h-64 animate-pulse rounded-[28px] bg-surface" aria-hidden />;

  if (!items.length)
    return (
      <>
        <div className="flex flex-col items-center rounded-[24px] bg-surface px-6 py-12 text-center md:py-16">
          <span className="mb-4 grid size-14 place-items-center rounded-full bg-surface-2">
            <Icon name="heart" size={24} />
          </span>
          <p className="text-h3">{T.emptyTitle}</p>
          <p className="mt-2 text-[15px] text-muted">{T.emptyBody}</p>
          <ButtonLink href="/collections/bestsellers" className="mt-6">
            {T.shopBest} <Icon name="arrowUpRight" size={16} />
          </ButtonLink>
        </div>
        <h2 className="mb-6 mt-16 text-poster md:mb-10 md:mt-28">{T.mostSaved}</h2>
        <ProductGrid products={productsIn("bestsellers").slice(0, 4)} wide eager={0} />
      </>
    );

  return (
    <>
      <p className="mb-5 text-[14px] text-muted tabular-nums">{plural(T.count, items.length)}</p>
      {/* minmax(0,1fr): without a column template the single phone column grew to its widest card and the page scrolled sideways */}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <WishItem key={p.id} p={p} />
        ))}
      </ul>
    </>
  );
}

function WishItem({ p: base }: { p: Product }) {
  const { d, t, product: localize } = useI18n();
  const T = d.collection.wishlist;
  const product = localize(base);
  // move the first colour that's still in stock; sizes reflect that colour's variants
  const color = product.colors.find((c) => colorStock(product, c.name) > 0) ?? product.colors[0];
  const p = withColorStock(product, color.name);
  const inStock = p.sizes.filter((s) => s.stock > 0);
  const [size, setSize] = useState(p.sizes.length === 1 ? p.sizes[0].label : "");
  const [error, setError] = useState(false);

  const move = () => {
    if (!size) return setError(true);
    actions.add({ productId: p.id, color: color.name, size });
    actions.toggleWish(p.id);
  };

  return (
    <li className="flex gap-4 rounded-[24px] bg-surface p-3">
      <Link href={`/products/${p.handle}`} className="relative aspect-[4/5] w-28 shrink-0 self-start overflow-hidden rounded-2xl bg-well sm:w-32">
        <Image src={color.images[0]} alt={p.title} fill sizes="128px" loading="lazy" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/products/${p.handle}`} className="line-clamp-2 text-[14px] font-semibold leading-snug hover:underline">
            {p.title}
          </Link>
          <button onClick={() => actions.toggleWish(p.id)} aria-label={t(T.remove, { title: p.title })} className="tap -me-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink">
            <Icon name="close" size={16} />
          </button>
        </div>
        {p.reviewCount > 0 ? (
          <span className="mt-1 flex items-center gap-1 text-[12px] text-muted">
            <Stars rating={p.rating} size={11} /> ({p.reviewCount.toLocaleString("en")})
          </span>
        ) : null}
        <Price price={p.price} compareAt={p.compareAt} size="sm" className="mt-1" />
        <div className="mt-auto pt-3">
          {p.sizes.length > 1 ? (
            <div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto" role="radiogroup" aria-label={T.size}>
              {p.sizes.map((s) => (
                <button
                  key={s.label}
                  role="radio"
                  aria-checked={size === s.label}
                  disabled={!s.stock}
                  onClick={() => {
                    setSize(s.label);
                    setError(false);
                  }}
                  className={cx("tap h-9 min-w-10 shrink-0 rounded-full px-2 text-[12px] font-semibold transition disabled:text-muted disabled:line-through disabled:opacity-50", size === s.label ? "bg-ink text-white" : "bg-surface-2 hover:bg-ink/10")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
          {error ? <p className="mb-1.5 text-[12px] font-medium text-sale" role="alert">{T.pickFirst}</p> : null}
          <button onClick={move} disabled={!inStock.length} className={buttonClass("primary", "sm", "w-full")}>
            <Icon name="bag" size={15} /> {inStock.length ? T.move : T.soldOut}
          </button>
        </div>
      </div>
    </li>
  );
}
