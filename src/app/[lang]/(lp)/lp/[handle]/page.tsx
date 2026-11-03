import "@/server/boot";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Ribbons } from "@/components/brand/ribbons";
import { LpGallery } from "@/components/lp/lp-gallery";
import { LpOrder } from "@/components/lp/lp-order";
import { LpStickyCta } from "@/components/lp/lp-sticky-cta";
import { Icon } from "@/components/ui/icon";
import { Accordion, Pill, Price, Stars } from "@/components/ui/primitives";
import { getProduct, getProducts } from "@/lib/catalog";
import { asLocale, formatMoney, localeHref } from "@/lib/i18n/store/config";
import { localizeProduct } from "@/lib/i18n/store/content";
import { getDict } from "@/lib/i18n/store/dict";
import type { I18n } from "@/lib/i18n/store/kit";
import { getI18n } from "@/lib/i18n/store/server";
import { bogoLabel, multiBuyLabel } from "@/lib/pricing";
import { getQuestions, getReviews } from "@/lib/reviews";
import type { Product } from "@/lib/types";

export const dynamicParams = true;

export function generateStaticParams() {
  return getProducts().map((p) => ({ handle: p.handle }));
}

/** Ad landing pages duplicate the PDP — keep them out of the index and point canonical at the product. */
export async function generateMetadata({ params }: PageProps<"/[lang]/lp/[handle]">): Promise<Metadata> {
  const { handle, lang } = await params;
  const locale = asLocale(lang);
  const base = getProduct(handle);
  if (!base) return {};
  const p = localizeProduct(base, locale);
  return {
    title: getDict(locale).lp.metaTitle.replace("{title}", p.title).replace("{price}", formatMoney(p.price, locale)),
    description: p.tagline,
    alternates: { canonical: localeHref(locale, `/products/${p.handle}`) },
    robots: { index: false, follow: true },
  };
}

export default async function LandingPage({ params }: PageProps<"/[lang]/lp/[handle]">) {
  const { handle } = await params;
  const base = getProduct(handle);
  if (!base) notFound();
  const i18n = await getI18n();
  const { d, t, p: plural, locale } = i18n;
  const L = d.lp;
  const p = i18n.product(base);
  // best real reviews first (no cherry-picked filter that could leave the section empty)
  const reviews = [...getReviews(base, 12)].sort((a, b) => b.rating - a.rating).slice(0, 3);
  const faqs = getQuestions(base).slice(0, 4);
  const benefits = p.highlights.slice(0, 3);
  const offer = bogoLabel(locale);

  return (
    <>
      <div className="container-x grid gap-4 pt-4 md:grid-cols-[1.05fr_1fr] md:gap-6 md:pt-6">
        {/* Hook first on mobile — message-match with the ad creative */}
        <div className="md:hidden">
          <Hook product={p} i18n={i18n} />
        </div>

        <div className="overflow-hidden rounded-[28px] bg-well md:sticky md:top-6 md:self-start">
          <LpGallery product={base} />
        </div>

        <div className="min-w-0 rounded-[28px] bg-surface p-5 md:p-10">
          <div className="hidden md:block">
            <Hook product={p} i18n={i18n} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Price price={p.price} compareAt={p.compareAt} size="lg" />
            {offer ? <Pill dot="bg-forest">{offer}</Pill> : null}
          </div>

          <ul className="mb-8 mt-5 space-y-2.5">
            {benefits.map((h) => (
              <li key={h} className="flex items-center gap-3 text-[16px]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-white">
                  <Icon name="check" size={13} strokeWidth={2.4} />
                </span>
                {h}
              </li>
            ))}
          </ul>

          <Suspense fallback={<div className="h-[900px] animate-pulse rounded-[20px] bg-surface-2" />}>
            <LpOrder product={base} />
          </Suspense>
        </div>
      </div>

      <Ribbons
        a={[...(multiBuyLabel(locale) ? [multiBuyLabel(locale)] : []), ...(offer ? [offer] : []), d.common.cashOnDelivery, p.title]}
        b={[L.ribbon.exchange, t(L.ribbon.gsm, { n: p.gsm ?? 400 }), L.ribbon.allEgypt]}
        className="mt-10 md:mt-16"
      />

      {p.reviewCount > 0 && reviews.length ? (
      <section className="container-x mt-10 md:mt-16" aria-labelledby="lp-reviews">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
          <h2 id="lp-reviews" className="text-poster">
            {plural(d.common.reviews, p.reviewCount)}
          </h2>
          <span className="flex items-center gap-2 text-[16px]">
            <Stars rating={p.rating} size={16} />{" "}
            <bdi dir="ltr">
              <b>{p.rating.toFixed(1)}</b> {L.outOf}
            </bdi>
          </span>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-col rounded-[28px] bg-surface p-5 md:p-8">
              <Stars rating={r.rating} size={14} />
              <p className="mt-4 text-[17px] font-semibold" dir="auto">
                {r.title}
              </p>
              <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed text-ink-2" dir="auto">
                {r.body}
              </p>
              <p className="mt-auto flex items-center gap-1.5 pt-5 text-[13px] text-muted">
                {r.verified ? <Icon name="verified" size={14} className="text-ink" aria-label={L.verified} /> : null}
                <bdi>{[r.author, r.city].filter(Boolean).join(locale === "ar" ? "، " : ", ")}</bdi>
                {r.size ? t(L.wears, { size: r.size }) : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
      ) : null}

      {faqs.length ? (
      <section className="container-x mt-16 md:mt-28" aria-labelledby="lp-faq">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-surface p-5 md:p-10">
          <h2 id="lp-faq" className="text-poster mb-4">
            {L.questions}
          </h2>
          {faqs.map((q, i) => (
            <Accordion key={q.q} title={q.q} defaultOpen={i === 0}>
              {q.a}
            </Accordion>
          ))}
          <a href="#order" className="tap mt-8 flex h-14 items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-white transition hover:bg-ink/85 active:scale-[0.98]">
            {L.orderNowCta} <Icon name="arrowUpRight" size={18} />
          </a>
        </div>
      </section>
      ) : null}

      <LpStickyCta price={p.price} />
    </>
  );
}

function Hook({ product: p, i18n: { d, p: plural } }: { product: Product; i18n: I18n }) {
  return (
    <div className="mb-5">
      {p.reviewCount > 0 ? (
        <a href="#lp-reviews" className="inline-flex min-h-11 items-center gap-2 text-[14px]">
          <Stars rating={p.rating} size={14} />
          <span className="font-semibold">{p.rating.toFixed(1)}</span>
          <span className="text-muted underline underline-offset-4">
            {plural(d.common.reviews, p.reviewCount)}
          </span>
        </a>
      ) : null}
      <h1 className="text-poster text-balance">{p.title}</h1>
      <p className="mt-2 text-[16px] text-ink-2">{p.tagline}</p>
    </div>
  );
}
