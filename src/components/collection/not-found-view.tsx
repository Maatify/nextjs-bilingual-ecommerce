import Link from "@/components/i18n/link";
import { Icon } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/primitives";
import { getVisibleCollections, productsIn } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n/store/server";
import { ProductGrid } from "./product-grid";

/** 404 that keeps shoppers moving: search, popular collections, bestsellers. */
export async function NotFoundView() {
  const { d, href, collection } = await getI18n();
  const T = d.collection.notFound;
  return (
    <div className="container-x pt-6 md:pt-12">
      <div className="flex flex-col items-center rounded-[24px] bg-surface px-5 py-12 text-center md:p-16">
        <p className="text-mega">404</p>
        <h1 className="mt-3 text-h2">{T.title}</h1>
        <p className="mt-2 text-[15px] text-muted">{T.body}</p>
        <form action={href("/search")} role="search" className="mt-6 w-full max-w-[460px]">
          <label className="flex h-12 items-center gap-3 rounded-full bg-surface-2 px-4 ring-1 ring-inset ring-ink/8 focus-within:ring-2 focus-within:ring-forest">
            <Icon name="search" size={18} className="shrink-0 text-muted" />
            <span className="sr-only">{T.label}</span>
            <input name="q" placeholder={T.placeholder} enterKeyHint="search" className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted" />
          </label>
        </form>
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {getVisibleCollections()
            .filter((c) => c.rule.type !== "all")
            .slice(0, 8)
            .map((c) => (
              <li key={c.handle}>
                <Link href={`/collections/${c.handle}`} className="tap inline-flex h-11 items-center rounded-full bg-surface-2 px-4 text-[14px] font-medium transition hover:bg-ink hover:text-white">
                  {collection(c).title}
                </Link>
              </li>
            ))}
        </ul>
        <ButtonLink href="/collections/all" className="mt-6">
          {T.shopAll} <Icon name="arrowUpRight" size={16} />
        </ButtonLink>
      </div>
      <h2 className="mb-6 mt-16 text-poster md:mb-10 md:mt-28">{T.bestsellers}</h2>
      <ProductGrid products={productsIn("bestsellers").slice(0, 4)} wide eager={2} />
    </div>
  );
}
