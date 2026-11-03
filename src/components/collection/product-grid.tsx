"use client";

import { useI18n } from "@/components/i18n/provider";
import { ProductCard } from "@/components/product/product-card";
import { cx } from "@/lib/format";
import { getOffer } from "@/lib/site";
import type { Product } from "@/lib/types";

/** Quiet inline offer tile — same 4:5 footprint as a product image so the grid rhythm holds. */
function OfferTile() {
  const { d, t } = useI18n();
  const T = d.collection.offer;
  const { buy, get } = getOffer().bogo;
  return (
    <div className="flex aspect-[4/5] flex-col justify-between rounded-[20px] bg-ink p-4 text-white md:rounded-[24px] md:p-6">
      <span className="flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[12px] font-semibold">
        <span className="size-1.5 rounded-full bg-amber" aria-hidden />
        {T.every}
      </span>
      <p className="font-poster text-[clamp(2.25rem,1.4rem+3vw,3.75rem)] leading-[0.9]">
        {t(T.buy, { n: buy })}
        <br />
        {t(T.get, { n: get })}
        <br />
        <span className="text-amber">{T.free}</span>
      </p>
      <p className="text-[12px] leading-snug text-white/70 md:text-[13px]">{T.note}</p>
    </div>
  );
}

/** Client component (localized via useI18n); still server-rendered for the Suspense fallback / SEO. */
export function ProductGrid({
  products,
  offerAt,
  eager = 1,
  wide,
}: {
  products: Product[];
  /** insert the Buy 2 Get 1 tile at this index (null/undefined = none) */
  offerAt?: number | null;
  eager?: number;
  /** grid without sidebar (search/wishlist): 4-up on desktop */
  wide?: boolean;
}) {
  const { d, t } = useI18n();
  const sizes = wide ? "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" : "(min-width: 1024px) 27vw, (min-width: 640px) 33vw, 50vw";
  const items: (Product | "offer")[] = [...products];
  // the tile only appears while Buy N Get M is switched on in /admin
  const { bogoEnabled, bogo } = getOffer();
  if (offerAt != null && bogoEnabled) items.splice(Math.min(offerAt, products.length), 0, "offer");

  return (
    <ul className={cx("grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:gap-x-5 md:gap-y-12", wide && "lg:grid-cols-4")}>
      {items.map((p, i) =>
        p === "offer" ? (
          <li key="offer" aria-label={t(d.collection.offer.aria, { buy: bogo.buy, get: bogo.get })}>
            <OfferTile />
          </li>
        ) : (
          <li key={p.id}>
            <ProductCard product={p} priority={i < eager} sizes={sizes} />
          </li>
        ),
      )}
    </ul>
  );
}
