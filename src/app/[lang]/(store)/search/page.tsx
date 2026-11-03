import "@/server/boot";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { ProductGrid } from "@/components/collection/product-grid";
import { searchProducts } from "@/lib/search";
import { Icon } from "@/components/ui/icon";
import { getVisibleCollections, productsIn } from "@/lib/catalog";
import { asLocale, fmt, localeHref, plural } from "@/lib/i18n/store/config";
import { localizeCollection } from "@/lib/i18n/store/content";
import { getDict } from "@/lib/i18n/store/dict";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  const locale = asLocale(lang);
  const S = getDict(locale).collection.search;
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  return {
    title: term ? fmt(S.titleFor, { term }) : S.title,
    robots: { index: false, follow: true },
    alternates: { canonical: localeHref(locale, "/search") },
  };
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  const locale = asLocale(lang);
  const d = getDict(locale);
  const S = d.collection.search;
  const SUGGEST = S.suggest.split(",");
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const results = term ? searchProducts(term) : [];

  return (
    <div className="container-x pt-6 md:pt-12">
      <h1 className="text-poster break-words">{term ? <>“{term}”</> : S.title}</h1>

      <form action={localeHref(locale, "/search")} role="search" className="mt-5 max-w-[640px] md:mt-8">
        <label className="flex h-14 items-center gap-3 rounded-full bg-surface ps-5 pe-2 ring-1 ring-inset ring-ink/8 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-forest">
          <Icon name="search" size={20} className="shrink-0 text-muted" />
          <span className="sr-only">{S.label}</span>
          <input name="q" defaultValue={term} placeholder={S.placeholder} enterKeyHint="search" className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted" />
          <button className="tap h-11 shrink-0 rounded-full bg-ink px-5 text-[14px] font-semibold text-white transition hover:bg-forest active:scale-95">{S.button}</button>
        </label>
      </form>

      {term ? (
        <p className="mt-5 text-[14px] text-muted" aria-live="polite">
          {fmt(S.found, { pieces: plural(locale, d.common.pieces, results.length) })}
        </p>
      ) : null}

      {results.length ? (
        <div className="mt-6 md:mt-10">
          <ProductGrid products={results} wide />
        </div>
      ) : (
        <div className="mt-8 md:mt-10">
          {term ? <p className="mb-8 text-[16px]">{S.nothing}</p> : null}
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{S.popular}</p>
              <ul className="flex flex-wrap gap-2">
                {SUGGEST.map((s) => (
                  <li key={s}>
                    <Link href={`/search?q=${encodeURIComponent(s)}`} className="tap inline-flex h-11 items-center rounded-full bg-surface px-4 text-[14px] font-medium ring-1 ring-inset ring-ink/8 transition hover:bg-ink hover:text-white">
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{S.browse}</p>
              <ul className="flex flex-wrap gap-2">
                {getVisibleCollections()
                  .filter((c) => c.rule.type !== "all")
                  .map((c) => (
                    <li key={c.handle}>
                      <Link href={`/collections/${c.handle}`} className="tap inline-flex h-11 items-center rounded-full bg-surface px-4 text-[14px] font-medium ring-1 ring-inset ring-ink/8 transition hover:bg-ink hover:text-white">
                        {localizeCollection(c, locale).title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
          <h2 className="mb-6 mt-16 text-poster md:mb-10 md:mt-28">{S.bestsellers}</h2>
          <ProductGrid products={productsIn("bestsellers").slice(0, 4)} wide eager={2} />
        </div>
      )}
    </div>
  );
}
