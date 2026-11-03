import { ProductCard } from "@/components/product/product-card";
import { getProducts } from "@/lib/catalog";
import { getContent } from "@/lib/data";
import { localizeContent } from "@/lib/i18n/store/content";
import { getI18n } from "@/lib/i18n/store/server";
import { PosterHeading } from "./shared";

/** Bestsellers by 24h sales — 2 cols on mobile, 4 on desktop — then "More to love": the rest of the catalog. */
export async function TheEdit() {
  const { d, locale } = await getI18n();
  const all = getProducts();
  const best = [...all].sort((a, b) => b.sold24h - a.sold24h).slice(0, 4);
  // second row: everything not already in the first one (hidden when the catalog has nothing left)
  // exactly one row of 4, side by side: products not in the first row first (newest first), topped up if needed
  const rest = all.filter((p) => !best.includes(p)).reverse();
  const more = [...rest, ...best.filter((p) => !rest.includes(p))].slice(0, Math.min(4, all.length));
  return (
    <section className="container-x mt-16 md:mt-28" aria-labelledby="edit-h">
      <PosterHeading id="edit-h" href="/collections/bestsellers" cta={d.home.edit.cta}>
        {localizeContent(getContent(), locale).home.editTitle}
      </PosterHeading>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5">
        {best.map((p, i) => (
          <li key={p.id} className="min-w-0">
            <ProductCard product={p} rank={i + 1} sizes="(min-width: 1440px) 340px, (min-width: 768px) 24vw, 46vw" />
          </li>
        ))}
      </ul>
      {more.length ? (
        <div className="mt-14 md:mt-20">
          <PosterHeading id="more-h" href="/collections/all" cta={d.home.edit.moreCta}>
            {d.home.edit.more}
          </PosterHeading>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5" aria-labelledby="more-h">
            {more.map((p) => (
              <li key={p.id} className="min-w-0">
                <ProductCard product={p} sizes="(min-width: 1440px) 340px, (min-width: 768px) 24vw, 46vw" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
