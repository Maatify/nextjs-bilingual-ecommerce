import Image from "next/image";
import Link from "@/components/i18n/link";
import { Tilt3D } from "@/components/fx/tilt";
import { ReviewPhotos } from "@/components/reviews/review-photos";
import { Icon } from "@/components/ui/icon";
import { Stars } from "@/components/ui/primitives";
import { getProducts } from "@/lib/catalog";
import { snapshot } from "@/lib/data";
import type { Dict } from "@/lib/i18n/store/en";
import { getI18n } from "@/lib/i18n/store/server";
import type { Product, StoredReview } from "@/lib/types";
import { getStoreRating } from "./shared";

type Item = { r: StoredReview; p: Product; thumb: string; photos: string[] };

/** Only REAL published reviews of live products, newest first. Nothing invented. */
function realReviews(): Item[] {
  const products = new Map(getProducts().map((p) => [p.id, p]));
  return snapshot()
    .reviews.filter((r) => r.status === "published" && products.has(r.productId) && (r.title || r.body))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 24)
    .map((r) => {
      const p = products.get(r.productId)!;
      const photos = r.photos?.length ? r.photos : r.photo ? [r.photo] : [];
      return { r, p, thumb: p.colors[0]?.images[0] || "", photos };
    });
}

/** Repeat the real set until a row is wide enough for a seamless loop. */
const fill = (list: Item[], min = 6) => (list.length >= min ? list : Array.from({ length: Math.ceil(min / list.length) }, () => list).flat());

function Card({ it, dup, d }: { it: Item; dup?: boolean; d: Dict }) {
  const { r, p, thumb, photos } = it;
  return (
    <li className="w-[300px] shrink-0 pe-3 md:w-[360px] md:pe-4">
      <Tilt3D max={6} scale={1.02} className="h-full rounded-[24px]">
        <figure className="fx-spot relative flex h-full flex-col rounded-[24px] bg-surface p-5 shadow-soft md:p-6">
          <Stars rating={r.rating} size={13} />
          {/* reviews are customer text in whatever language they wrote — let each paragraph pick its direction */}
          <blockquote className="mt-3 flex-1" dir="auto">
            {r.title ? <p className="text-[16px] font-semibold leading-snug md:text-[17px]">&ldquo;{r.title}&rdquo;</p> : null}
            {r.body ? <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-muted">{r.body}</p> : null}
          </blockquote>
          {photos.length ? <ReviewPhotos photos={photos} name={r.author} size={48} inert={dup} className="mt-4" /> : null}
          <figcaption className="mt-5 flex items-center gap-3">
            {thumb ? (
              <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-well">
                <Image src={thumb} alt="" fill sizes="44px" className="object-cover" loading="lazy" />
              </span>
            ) : null}
            <span className="min-w-0 text-[13px]">
              <span className="flex items-center gap-1.5">
                <bdi className="truncate font-semibold">{r.author}</bdi>
                {r.verified ? <Icon name="verified" size={14} className="shrink-0 text-forest" aria-label={d.home.reviews.verified} /> : null}
                {r.city ? <span className="truncate text-muted">· {r.city}</span> : null}
              </span>
              <Link href={`/products/${p.handle}`} tabIndex={dup ? -1 : undefined} className="block truncate text-muted hover:text-ink">
                {p.title}
              </Link>
            </span>
          </figcaption>
        </figure>
      </Tilt3D>
    </li>
  );
}

function Row({ items, reverse, label, d }: { items: Item[]; reverse?: boolean; label: string; d: Dict }) {
  return (
    <div className="fx-marquee-wrap fx-fade-x overflow-hidden py-3 motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]" role="region" aria-label={label}>
      {/* the track follows the page direction: in Arabic it starts at the right and the loop runs mirrored (--mq-dir) */}
      <div className={`fx-marquee flex w-max${reverse ? " fx-rev" : ""}`} style={{ "--marquee-dur": `${Math.max(40, items.length * 9)}s` } as React.CSSProperties}>
        <ul className="flex">
          {items.map((it, i) => (
            <Card key={`${it.r.id}-${i}`} it={it} d={d} />
          ))}
        </ul>
        <ul className="fx-marquee-dup flex" aria-hidden="true">
          {items.map((it, i) => (
            <Card key={`d-${it.r.id}-${i}`} it={it} d={d} dup />
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Real customer reviews drifting in two slow, opposite rows. Hidden entirely when there are none. */
export async function Reviews() {
  const { d, p: plural, product } = await getI18n();
  const all = realReviews().map((it) => ({ ...it, p: product(it.p) }));
  if (!all.length) return null;
  const storeRating = getStoreRating();
  const a = all.filter((_, i) => i % 2 === 0);
  const b = all.length > 1 ? all.filter((_, i) => i % 2 === 1) : [...all];
  const rowA = fill(a);
  const rowB = fill(b.length ? [...b].reverse() : a);

  return (
    <section className="mt-16 md:mt-28" aria-labelledby="reviews-h">
      <div className="container-x mb-4 flex flex-wrap items-end gap-x-5 gap-y-2 md:mb-6">
        <p className="font-poster text-[72px] leading-[0.85] md:text-[104px]">{storeRating.avg.toFixed(1)}</p>
        <div className="pb-1">
          <Stars rating={storeRating.avg} size={16} />
          <h2 id="reviews-h" className="mt-1.5 text-[15px] font-semibold">
            {plural(d.home.reviews.count, storeRating.count)}
          </h2>
        </div>
      </div>
      <Row items={rowA} label={d.home.reviews.rowA} d={d} />
      <Row items={rowB} reverse label={d.home.reviews.rowB} d={d} />
    </section>
  );
}
