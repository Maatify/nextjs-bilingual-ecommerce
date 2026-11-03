import Link from "@/components/i18n/link";
import { Icon } from "@/components/ui/icon";
import { ButtonLink, Stars } from "@/components/ui/primitives";
import { getProductById, getProducts } from "@/lib/catalog";
import { getContent } from "@/lib/data";
import { localizeContent } from "@/lib/i18n/store/content";
import type { I18n } from "@/lib/i18n/store/kit";
import { getI18n } from "@/lib/i18n/store/server";
import { getSite } from "@/lib/site";
import { magnetic } from "@/components/fx/press";
import type { Bestseller } from "@/server/queries/bestsellers";
import { pctOffLabel } from "@/components/ui/offer-chip";
import { pctOff } from "@/lib/format";
import { multiBuy } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { HeroCollage, type HeroShot } from "./hero-collage";
import { Dot, getStoreRating } from "./shared";

/** Describe a hero image from the product/colour it belongs to (falls back to the store name). */
function describe(src: string, { d, t, product, color }: I18n) {
  for (const p of getProducts()) {
    const c = p.colors.find((x) => x.images.includes(src));
    if (c) return { alt: t(d.home.hero.altModel, { title: product(p).title, color: color(p, c.name) }), product: p, color: c.name };
  }
  return { alt: t(d.home.hero.lookbook, { name: getSite().name }), product: undefined, color: undefined };
}

/** Same chip as the product cards: the real sale % if there is one, otherwise the live multi-buy offer. */
function offerLabel(p: Product | undefined, locale: "en" | "ar") {
  if (!p) return undefined;
  const off = pctOff(p.price, p.compareAt);
  if (off) return pctOffLabel(off, locale);
  const mb = multiBuy();
  if (!mb) return undefined;
  return locale === "ar" ? `خصم ${mb.pct}% ${mb.qty === 2 ? "لقطعتين" : `على ${mb.qty} ${mb.qty > 10 ? "قطعة" : "قطع"}`}` : `${mb.qty}\u202F×\u202F${mb.pct}% OFF`;
}

/**
 * Threadnova headline + Linea panel: mega condensed title, one line of copy,
 * two pill CTAs, a photo row and a floating product card. Copy, CTAs, images and
 * the featured product come from /admin → Content → Home.
 */
export async function Hero({ bestsellers }: { bestsellers?: { items: Bestseller[]; period: "month" | "all" } | null }) {
  const i18n = await getI18n();
  const { d, t, p: plural, money, product, color, locale } = i18n;
  const h = d.home.hero;
  const hero = localizeContent(getContent(), locale).home.hero;
  const storeRating = getStoreRating();
  // Real top 3 (only when the admin switch is on AND there's enough real sales data) — else the hand-picked images, no ranking claims.
  const best = hero.autoBestsellers !== false && bestsellers && bestsellers.items.length >= 3 ? bestsellers : null;
  // Three shots — the first is the page's single preloaded (LCP) image.
  const picked = hero.images.filter(Boolean).slice(0, 3).map((src) => ({ src, ...describe(src, i18n) }));
  const collage: HeroShot[] = best
    ? best.items.map((b) => {
        const bp = getProductById(b.productId);
        const title = bp ? product(bp).title : b.title;
        const price = money(b.price);
        return {
          src: b.image,
          alt: t(d.home.altIn, { title, color: color(bp, b.color) }),
          rank: b.rank,
          title,
          price,
          offer: offerLabel(bp, locale),
          href: `/products/${b.handle}?color=${encodeURIComponent(b.color)}`,
        };
      })
    : picked.map((s) => ({
        src: s.src,
        alt: s.alt,
        offer: offerLabel(s.product, locale),
        href: s.product ? `/products/${s.product.handle}${s.color ? `?color=${encodeURIComponent(s.color)}` : ""}` : undefined,
      }));
  const featuredBase = best ? undefined : getProductById(hero.featuredProductId);
  const featured = featuredBase ? product(featuredBase) : undefined;
  const featuredColor = featured ? picked.find((s) => s.product?.id === featured.id)?.color : undefined;
  const titleLines = hero.title.split(/\n/);

  return (
    <section className="container-x pt-2 md:pt-4" aria-labelledby="hero-title">
      <div className="rounded-[28px] bg-surface p-5 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {hero.eyebrow ? <Dot>{hero.eyebrow}</Dot> : <span />}
          {storeRating.count ? (
            <a href="#reviews-h" className="inline-flex items-center gap-2 text-[13px] font-medium">
              <Stars rating={storeRating.avg} size={13} />
              <span className="tabular-nums">
                {storeRating.avg.toFixed(1)} · {plural(d.common.reviews, storeRating.count)}
              </span>
            </a>
          ) : null}
        </div>

        <h1 id="hero-title" className="text-mega mt-5 text-balance md:mt-8">
          {titleLines.map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </h1>

        {/* 1fr:2fr on tablets — at 0.8fr the 768px column was ~170px and "Shop bestsellers ↗" got its arrow clipped */}
        <div className="mt-5 grid gap-6 md:mt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-5 md:justify-between">
            {hero.subtitle ? <p className="max-w-[30ch] text-[16px] leading-relaxed text-ink-2">{hero.subtitle}</p> : null}
            <div className="flex flex-wrap gap-2">
              {hero.primary.label ? (
                <ButtonLink href={hero.primary.href} size="md" className={`fx-press ${magnetic.className}`} data-magnetic={magnetic["data-magnetic"]}>
                  {hero.primary.label} <Icon name="arrowUpRight" size={16} />
                </ButtonLink>
              ) : null}
              {hero.secondary.label ? (
                <ButtonLink href={hero.secondary.href} variant="outline" size="md" className="fx-press border-transparent bg-surface-2">
                  {hero.secondary.label} <Icon name="arrowUpRight" size={16} />
                </ButtonLink>
              ) : null}
            </div>
          </div>

          <div className="relative">
            {best ? (
              <p className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-2 md:mb-3">
                <span className="size-1.5 rounded-full bg-sale" aria-hidden />
                {best.period === "month" ? h.bestThisMonth : h.ourBest}
              </p>
            ) : null}
            <HeroCollage shots={collage} shopLabel={h.shop} />

            {/* Linea floating info card */}
            {featured ? (
            <div className="absolute inset-x-2 bottom-2 flex items-center gap-3 rounded-[18px] bg-white/95 p-2 ps-3 shadow-lift md:inset-x-auto md:bottom-4 md:inset-s-4 md:w-[300px]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{featured.title}</span>
                <span className="block text-[13px] tabular-nums text-muted">
                  {money(featured.price)}
                  {featured.compareAt ? <s className="ms-1.5">{money(featured.compareAt)}</s> : null}
                </span>
              </span>
              <Link
                href={`/products/${featured.handle}${featuredColor ? `?color=${encodeURIComponent(featuredColor)}` : ""}`}
                className="tap inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-4 text-[13px] font-semibold transition hover:bg-ink hover:text-white active:scale-[0.97]"
                aria-label={t(h.viewLabel, { title: featured.title })}
              >
                {h.view} <Icon name="arrowUpRight" size={14} />
              </Link>
            </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
