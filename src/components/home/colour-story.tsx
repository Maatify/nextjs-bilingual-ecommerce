import Image from "next/image";
import Link from "@/components/i18n/link";
import { getProductById, getProducts } from "@/lib/catalog";
import { getContent } from "@/lib/data";
import { localizeContent } from "@/lib/i18n/store/content";
import { getI18n } from "@/lib/i18n/store/server";
import { PosterHeading } from "./shared";

/** One hoodie, every colour — a light swatch rail that deep-links to the colour on the PDP. */
export async function ColourStory() {
  const { d, t, locale, product, color } = await getI18n();
  const content = localizeContent(getContent(), locale).home;
  // The hero's featured product, falling back to whichever product has the most colours.
  const base = getProductById(content.hero.featuredProductId) ?? [...getProducts()].sort((a, b) => b.colors.length - a.colors.length)[0];
  if (!base || base.colors.length < 2) return null;
  const HOODIE = product(base);
  return (
    <section className="mt-16 md:mt-28" aria-labelledby="colour-h">
      <div className="container-x">
        <PosterHeading id="colour-h" href={`/products/${HOODIE.handle}`} cta={HOODIE.category === "Hoodies" ? d.home.colour.theHoodie : HOODIE.title}>
          {content.colourStoryTitle || t(d.home.colour.fallbackTitle, { n: HOODIE.colors.length, title: HOODIE.title })}
        </PosterHeading>
      </div>
      <ul className="no-scrollbar container-x flex snap-x scroll-px-(--gutter) gap-2 overflow-x-auto md:grid md:grid-cols-8 md:gap-3 md:overflow-visible">
        {HOODIE.colors.map((c) => (
          <li key={c.name} className="w-[36%] shrink-0 snap-start sm:w-[24%] md:w-auto">
            <Link href={`/products/${HOODIE.handle}?color=${encodeURIComponent(c.name)}`} className="group block">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[18px] bg-well">
                <Image
                  src={c.images[0]}
                  alt={t(d.home.altIn, { title: HOODIE.title, color: color(HOODIE, c.name) })}
                  fill
                  sizes="(min-width: 1440px) 170px, (min-width: 768px) 12vw, (min-width: 640px) 24vw, 36vw"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.03]"
                />
              </span>
              <span className="mt-2.5 flex items-center gap-2 text-[13px] font-medium">
                <span className="size-3 shrink-0 rounded-full ring-1 ring-ink/15" style={{ background: c.hex }} aria-hidden />
                <span className="truncate">{color(HOODIE, c.name)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
