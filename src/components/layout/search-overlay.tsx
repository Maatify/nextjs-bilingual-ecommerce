"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { getProductById, getVisibleCollections } from "@/lib/catalog";
import { searchProducts } from "@/lib/search";
import { actions, useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

export function SearchOverlay() {
  const open = useStore((s) => s.searchOpen);
  const recent = useStore((s) => s.recent);
  const router = useRouter();
  const { d, t, href, collection } = useI18n();
  const s = d.layout.search;
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const results = useMemo(() => searchProducts(dq).slice(0, 6), [dq]);
  // match the collection name in either language
  const matchingCollections = useMemo(() => {
    const needle = dq.toLowerCase().trim();
    if (!needle) return [];
    return getVisibleCollections()
      .filter((c) => c.title.toLowerCase().includes(needle) || collection(c).title.toLowerCase().includes(needle))
      .slice(0, 3);
  }, [dq, collection]);
  const close = () => actions.setSearchOpen(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName)) {
        e.preventDefault();
        actions.setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const recentProducts = recent.map(getProductById).filter(Boolean).slice(0, 4) as Product[];

  return (
    <Sheet open={open} onClose={close} title={s.title} side="center" width="max-w-[720px] md:h-auto" hideHeader>
      <form
        role="search"
        className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-4 pt-4 md:-mx-6 md:px-6 md:pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          close();
          router.push(href(`/search?q=${encodeURIComponent(q.trim())}`));
        }}
      >
        <div className="flex items-center gap-2">
          <label className="flex h-12 flex-1 items-center gap-3 rounded-full bg-surface-2 px-4 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-forest">
            <Icon name="search" size={20} className="text-muted" />
            <span className="sr-only">{s.label}</span>
            <input
              data-autofocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={s.placeholder}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
              enterKeyHint="search"
              autoComplete="off"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} className="tap text-[12px] font-semibold text-muted" aria-label={s.clearLabel}>
                {s.clear}
              </button>
            ) : null}
          </label>
          <button type="button" onClick={close} className="tap h-12 px-3 text-[14px] font-semibold">
            {s.cancel}
          </button>
        </div>
      </form>

      {!dq.trim() ? (
        <div className="space-y-7 pb-4">
          <div>
            <p className="mb-3 text-[13px] font-semibold text-muted">{s.popular}</p>
            <div className="flex flex-wrap gap-2">
              {s.trending.map((term) => (
                <button key={term} onClick={() => setQ(term)} className="tap flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-[13px] font-medium transition hover:bg-ink hover:text-white">
                  {term}
                </button>
              ))}
            </div>
          </div>
          {recentProducts.length ? (
            <div>
              <p className="mb-3 text-[13px] font-semibold text-muted">{s.recent}</p>
              <ResultList items={recentProducts} onPick={close} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="pb-4" aria-live="polite">
          {matchingCollections.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {matchingCollections.map((c) => (
                <Link key={c.handle} href={`/collections/${c.handle}`} onClick={close} className="flex h-9 items-center gap-1 rounded-full border border-line px-4 text-[13px] font-medium">
                  {collection(c).title} <Icon name="arrowRight" size={14} />
                </Link>
              ))}
            </div>
          ) : null}
          {results.length ? (
            <>
              <ResultList items={results} onPick={close} />
              <Link href={`/search?q=${encodeURIComponent(dq)}`} onClick={close} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-surface-2 py-3 text-[14px] font-semibold">
                {s.viewAll} <Icon name="arrowRight" size={16} />
              </Link>
            </>
          ) : (
            <div className="py-10 text-center">
              <p className="font-semibold">{t(s.noResults, { q: dq })}</p>
              <p className="mt-1 text-[14px] text-muted">{s.tryHint}</p>
              <Link href="/collections/bestsellers" onClick={close} className="mt-4 inline-block text-[14px] font-semibold underline underline-offset-4">
                {s.shopBestsellers}
              </Link>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ResultList({ items, onPick }: { items: Product[]; onPick: () => void }) {
  const { product } = useI18n();
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={`/products/${p.handle}`} onClick={onPick} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface-2">
            <span className="relative h-16 w-[52px] shrink-0 overflow-hidden rounded-xl bg-well">
              <Image src={p.colors[0].images[0]} alt="" fill sizes="52px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">{product(p).title}</span>
              <Price price={p.price} compareAt={p.compareAt} size="sm" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
