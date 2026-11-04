import "@/server/boot";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionBrowser, CollectionView } from "@/components/collection/collection-browser";
import { JsonLd } from "@/components/json-ld";
import { cx } from "@/lib/format";
import { getCollection, getCollections, productsIn } from "@/lib/catalog";
import { asLocale, fmt, localeHref, ogLocale, plural } from "@/lib/i18n/store/config";
import { localizeCollection } from "@/lib/i18n/store/content";
import { getDict } from "@/lib/i18n/store/dict";
import { bogoLabel } from "@/lib/pricing";
import { alternatesFor, breadcrumbLd, itemListLd } from "@/lib/seo";
import { getSite } from "@/lib/site";

export const dynamicParams = true;

export function generateStaticParams() {
  return getCollections().map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/collections/[handle]">): Promise<Metadata> {
  const { handle, lang } = await params;
  const locale = asLocale(lang);
  const raw = getCollection(handle);
  if (!raw) return {};
  const c = localizeCollection(raw, locale);
  const d = getDict(locale);
  const P = d.collection.page;
  const site = getSite();
  const n = productsIn(handle).length;
  const offer = bogoLabel(locale);
  const title = c.seoTitle || (c.handle === "all" ? P.metaAll : fmt(P.metaTitle, { title: c.title }));
  const vars = { desc: c.description, pieces: plural(locale, d.common.pieces, n), site: site.name, offer };
  const description = c.seoDescription || fmt(offer ? P.metaDescOffer : P.metaDesc, vars);
  return {
    // merchant SEO titles that already carry the brand skip the "| VEDRA" template
    title: title.includes(getSite().name) ? { absolute: title } : title,
    description,
    alternates: alternatesFor(`/collections/${handle}`, locale),
    openGraph: { type: "website", siteName: site.name, title: `${c.title} | ${site.name}`, description, url: localeHref(locale, `/collections/${handle}`), locale: ogLocale(locale), images: [{ url: c.image, alt: c.title }] },
  };
}

export default async function CollectionPage({ params }: PageProps<"/[lang]/collections/[handle]">) {
  const { handle, lang } = await params;
  const locale = asLocale(lang);
  const raw = getCollection(handle);
  if (!raw) notFound();
  const d = getDict(locale);
  const P = d.collection.page;
  const c = localizeCollection(raw, locale);
  const items = productsIn(handle);
  // Quick-switch chips: every visible collection, plus the current one if it's hidden (e.g. reached from an ad).
  const listed = getCollections()
    .filter((x) => !x.hidden || x.handle === c.handle)
    .map((x) => localizeCollection(x, locale));
  // Sub-categories (admin › Categories › Parent) show only next to their parent's chip, when it's the active branch.
  const known = new Set(listed.map((x) => x.handle));
  const isChild = (x: (typeof listed)[number]) => !!x.parent && known.has(x.parent);
  const branch = isChild(c) ? c.parent : c.handle;
  const chips = listed.filter((x) => !isChild(x)).flatMap((x) => [x, ...(x.handle === branch ? listed.filter((y) => y.parent === x.handle) : [])]);
  // one quiet Buy 2 Get 1 tile; on single-item edits it fills the empty slot beside the product
  const offerAt = Math.min(3, items.length);
  const heading = c.handle === "all" ? P.shopEdit : c.title;

  return (
    <>
      <div className="container-x pt-6 md:pt-12">
        <header className="mb-6 md:mb-10">
          <h1 className="text-poster">{heading}</h1>
          <p className="mt-3 text-[15px] text-muted md:text-[16px]">{c.description}</p>
        </header>

        <nav aria-label={P.nav} className="no-scrollbar -mx-(--gutter) mb-4 flex gap-2 overflow-x-auto px-(--gutter) md:mb-8">
          {chips.map((s) => {
            const on = s.handle === c.handle;
            return (
              <Link
                key={s.handle}
                href={`/collections/${s.handle}`}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "tap inline-flex h-11 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold transition",
                  on ? "bg-ink text-white" : "bg-surface ring-1 ring-inset ring-ink/8 hover:ring-ink/30",
                  !on && s.handle === "sale" && "text-sale",
                )}
              >
                {s.handle === "all" ? P.all : s.title}
              </Link>
            );
          })}
        </nav>
      </div>

      <section id="grid" className="container-x scroll-mt-[calc(var(--header-h)+16px)]" aria-label={fmt(P.products, { title: c.title })}>
        {/* Fallback = same UI with default filters: crawlable, no layout shift when URL filters hydrate */}
        <Suspense fallback={<CollectionView products={items} offerAt={offerAt} />}>
          <CollectionBrowser products={items} offerAt={offerAt} />
        </Suspense>
      </section>

      <JsonLd
        data={[
          breadcrumbLd(
            [
              { name: d.common.home, path: "/" },
              { name: c.title, path: `/collections/${c.handle}` },
            ],
            locale,
          ),
          itemListLd(items, locale),
        ]}
      />
    </>
  );
}
