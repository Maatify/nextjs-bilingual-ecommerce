import "@/server/boot";
import type { Metadata } from "next";
import { Fragment } from "react";
import { Ribbons } from "@/components/brand/ribbons";
import { Categories } from "@/components/home/categories";
import { ColourStory } from "@/components/home/colour-story";
import { Hero } from "@/components/home/hero";
import { HomeFaq } from "@/components/home/home-faq";
import { MatchingSet } from "@/components/home/matching-set";
import { Reviews } from "@/components/home/reviews";
import { TheEdit } from "@/components/home/the-edit";
import { TrustStrip } from "@/components/home/trust-strip";
import { getContent } from "@/lib/data";
import { asLocale, ogLocale } from "@/lib/i18n/store/config";
import { localizeContent } from "@/lib/i18n/store/content";
import { getDict } from "@/lib/i18n/store/dict";
import { getLocale } from "@/lib/i18n/store/server";
import { alternatesFor, siteDescription } from "@/lib/seo";
import { getSite } from "@/lib/site";
import { multiBuyLabel } from "@/lib/pricing";
import type { HomeSectionId } from "@/lib/types";
import { getBestsellers } from "@/server/queries/bestsellers";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const locale = asLocale((await params).lang);
  const site = getSite();
  const hero = localizeContent(getContent(), locale).home.hero;
  const image = hero.images.find(Boolean);
  const description = siteDescription(locale);
  const sep = locale === "ar" ? " | " : " — "; // no em-dash in Arabic copy
  return {
    title: { absolute: `${site.name}${sep}${getDict(locale).pages.meta.homeTitle}` },
    description,
    alternates: alternatesFor("/", locale),
    openGraph: {
      title: `${site.name}${sep}${hero.title.replace(/\n/g, " ")}`,
      description,
      type: "website",
      siteName: site.name,
      locale: ogLocale(locale),
      alternateLocale: [ogLocale(locale === "ar" ? "en" : "ar")],
      url: locale === "ar" ? "/ar" : "/",
      images: image ? [{ url: image, width: 960, height: 1200, alt: `${site.name}${sep}${hero.title.replace(/\n/g, " ")}` }] : undefined,
    },
  };
}

/** Put the live multi-buy line after the first ribbon item, unless the merchant already wrote a % offer. */
const withMultiBuy = (items: string[], label: string) => (!label || items.some((x) => x.includes("%")) ? items : [...items.slice(0, 1), label, ...items.slice(1)]);

/** Home: one job per section. Order and visibility come from /admin → Content → Home. */
export default async function Home() {
  const locale = await getLocale();
  const { home, ribbons } = localizeContent(getContent(), locale);
  const render: Record<HomeSectionId, () => React.ReactNode> = {
    // real top 3 by units sold (null → hero falls back to hand-picked images, no ranking claims)
    hero: () => <Hero bestsellers={home.hero.autoBestsellers !== false ? getBestsellers(3) : null} />,
    ribbons: () => <Ribbons a={withMultiBuy(ribbons.a, multiBuyLabel(locale))} b={ribbons.b} className="-mt-3 md:-mt-6" />,
    categories: () => <Categories />,
    edit: () => <TheEdit />,
    "matching-set": () => <MatchingSet />,
    "colour-story": () => <ColourStory />,
    reviews: () => <Reviews />,
    trust: () => <TrustStrip />,
    faq: () => <HomeFaq />,
  };
  return (
    <>
      {home.sections
        .filter((s) => s.enabled && render[s.id])
        .map((s) => (
          <Fragment key={s.id}>{render[s.id]()}</Fragment>
        ))}
    </>
  );
}
