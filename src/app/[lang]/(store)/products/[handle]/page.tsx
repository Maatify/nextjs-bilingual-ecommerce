import "@/server/boot";
import { getSite } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { ProductRail } from "@/components/pdp/product-rail";
import { ProductView, ProductViewWithParams } from "@/components/pdp/product-view";
import { Questions } from "@/components/pdp/questions";
import { Reviews } from "@/components/pdp/reviews";
import { getCollection, getProduct, getProducts, related } from "@/lib/catalog";
import { asLocale, fmt, formatMoney, localeHref, ogLocale, plural } from "@/lib/i18n/store/config";
import { categoryName, localizeCollection, localizeProduct } from "@/lib/i18n/store/content";
import { getDict } from "@/lib/i18n/store/dict";
import { bogoLabel } from "@/lib/pricing";
import { getQuestions, getReviews, ratingBreakdown } from "@/lib/reviews";
import { alternatesFor, breadcrumbLd, productLd } from "@/lib/seo";

export const dynamicParams = true;

export function generateStaticParams() {
  return getProducts().map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/products/[handle]">): Promise<Metadata> {
  const { handle, lang } = await params;
  const locale = asLocale(lang);
  const base = getProduct(handle);
  if (!base) return {};
  const d = getDict(locale);
  const M = d.product.meta;
  // localizeProduct keeps the merchant's Arabic SEO fields, or drops the English ones so the Arabic fallback below is used
  const p = localizeProduct(base, locale);
  const money = (n: number) => formatMoney(n, locale);
  const title = p.seoTitle || fmt(M.title, { title: p.title, category: categoryName(p, locale) });
  const offer = bogoLabel(locale);
  const generated = `${p.tagline} ${money(p.price)}${p.compareAt ? fmt(M.was, { price: money(p.compareAt) }) : ""}.${p.reviewCount > 0 ? fmt(M.rating, { rating: p.rating, reviews: plural(locale, d.common.reviews, p.reviewCount) }) : ""}${offer ? ` ${offer}.` : ""}`;
  // the COD/exchanges tail is dropped when it would push the snippet past ~155 chars (search engines cut it off)
  const description = p.seoDescription || ([...(generated + M.tail)].length <= 155 ? generated + M.tail : generated);
  const url = localeHref(locale, `/products/${p.handle}`);
  return {
    // merchant SEO titles that already carry the brand skip the "| VERDA" template
    title: title.includes(getSite().name) ? { absolute: title } : title,
    description,
    alternates: alternatesFor(`/products/${p.handle}`, locale),
    openGraph: { type: "website", siteName: getSite().name, title, description, url, locale: ogLocale(locale) },
    twitter: { card: "summary_large_image", title, description },
    other: {
      "product:price:amount": String(p.price),
      "product:price:currency": "EGP",
      "product:availability": p.sizes.some((s) => s.stock > 0) ? "in stock" : "out of stock",
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/[lang]/products/[handle]">) {
  const { handle, lang } = await params;
  const locale = asLocale(lang);
  const p = getProduct(handle);
  if (!p) notFound();
  const d = getDict(locale);

  const reviews = getReviews(p, 24);
  const questions = getQuestions(p, 6, locale);
  const raw = getCollection(p.collections[0]);
  const collection = raw ? localizeCollection(raw, locale) : undefined;
  const title = localizeProduct(p, locale).title;

  return (
    <>
      {/* Static HTML renders the default variant; the client swaps in ?color=&size=&qty= deep-link preselection. */}
      <Suspense fallback={<ProductView product={p} />}>
        <ProductViewWithParams product={p} />
      </Suspense>

      <div className="container-x mt-16 space-y-16 md:mt-28 md:space-y-28">
        <div className="space-y-3">
          <Reviews product={p} reviews={reviews} breakdown={ratingBreakdown(p)} />
          <Questions questions={questions} productTitle={title} />
        </div>
        <ProductRail title={d.product.view.alsoLike} items={related(p, 5)} />
      </div>

      <JsonLd
        data={[
          productLd(p, locale),
          breadcrumbLd(
            [
              { name: d.common.home, path: "/" },
              ...(collection ? [{ name: collection.title, path: `/collections/${collection.handle}` }] : []),
              { name: title, path: `/products/${p.handle}` },
            ],
            locale,
          ),
        ]}
      />
    </>
  );
}
