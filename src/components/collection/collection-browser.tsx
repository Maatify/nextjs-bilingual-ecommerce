"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { cx } from "@/lib/format";
import type { Product } from "@/lib/types";
import { activeCount, applyFilters, facets, PRICE_BANDS, parseFilters, SORTS, sortProducts, toQuery, type FilterState, type SortValue } from "./filters";
import { ProductGrid } from "./product-grid";
import { categoryLabel } from "@/lib/i18n/store/content";

const EMPTY = new URLSearchParams();

type Props = { products: Product[]; offerAt?: number | null };

/** Reads filters from the URL. Must sit inside <Suspense>; use `CollectionView` (default filters) as the fallback for an identical, shift-free first paint. */
export function CollectionBrowser(props: Props) {
  const sp = useSearchParams();
  return <CollectionView {...props} sp={sp} />;
}

export function CollectionView({ products, offerAt, sp = EMPTY }: Props & { sp?: { get(key: string): string | null } }) {
  const router = useRouter();
  // the browser path (already /ar/… on Arabic pages) — replacing it keeps the language
  const pathname = usePathname();
  const { d, t, p: plural, color: colorLabel, categoryLabel } = useCollectionI18n();
  const T = d.collection.filters;
  const f = useMemo(() => parseFilters(sp), [sp]);
  const [sheet, setSheet] = useState(false);

  const results = useMemo(() => sortProducts(applyFilters(products, f), f.sort), [products, f]);
  const count = activeCount(f);

  const update = (next: Partial<FilterState>) => {
    const qs = toQuery({ ...f, ...next });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const toggle = (key: FacetKey, value: string) => update({ [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] });
  const clear = () => update({ size: [], color: [], price: [], cat: [] });

  const chips = [
    ...f.cat.map((v) => ({ key: "cat" as const, v, label: categoryLabel(v) })),
    ...f.size.map((v) => ({ key: "size" as const, v, label: t(T.sizeChip, { size: v }) })),
    ...f.color.map((v) => ({ key: "color" as const, v, label: colorLabel(ownerOf(products, v), v) })),
    ...f.price.map((v) => ({ key: "price" as const, v, label: T.bands[v as keyof typeof T.bands] ?? PRICE_BANDS.find((b) => b.value === v)?.label ?? v })),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
      {/* Desktop sidebar (Threadnova-style quiet list) */}
      <aside className="hidden lg:block" aria-label={T.title}>
        <div className="sticky top-[calc(var(--header-h)+24px)] max-h-[calc(100dvh-var(--header-h)-48px)] overflow-y-auto pb-6 pe-1">
          <div className="flex h-10 items-center justify-between border-b border-line">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <Icon name="sliders" size={16} /> {T.title}
            </p>
            {count ? (
              <button onClick={clear} className="tap text-[13px] font-medium text-muted underline underline-offset-4 hover:text-ink">
                {T.clear}
              </button>
            ) : null}
          </div>
          <FilterPanel products={products} f={f} toggle={toggle} />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Toolbar: sticky on mobile */}
        <div className="sticky top-[var(--header-h)] z-20 -mx-(--gutter) mb-5 bg-bg px-(--gutter) py-2.5 lg:static lg:mx-0 lg:mb-6 lg:bg-transparent lg:p-0 lg:">
          {/* flex-wrap: on the narrowest phones the item count drops to its own line instead of being clipped */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSheet(true)}
              className="tap inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-white transition active:scale-95 lg:hidden"
            >
              <Icon name="sliders" size={16} /> {T.filter}
              {count ? <span className="grid size-5 place-items-center rounded-full bg-white text-[11px] text-ink tabular-nums">{count}</span> : null}
            </button>
            <label className="relative inline-flex h-11 shrink-0 items-center rounded-full bg-surface ps-4 pe-9 text-[14px] font-semibold ring-1 ring-inset ring-ink/8">
              <select value={f.sort} onChange={(e) => update({ sort: e.target.value as SortValue })} className="tap absolute inset-0 cursor-pointer appearance-none opacity-0" aria-label={T.sortBy}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {T.sorts[s.value]}
                  </option>
                ))}
              </select>
              <span aria-hidden className="pointer-events-none">
                <span className="hidden text-muted sm:inline">{T.sortPrefix}</span>
                {T.sorts[f.sort]}
              </span>
              <Icon name="chevronDown" size={14} className="pointer-events-none absolute inset-e-3.5" />
            </label>
            <p className="ms-auto text-[13px] text-muted tabular-nums" aria-live="polite">
              {plural(d.common.pieces, results.length)}
            </p>
          </div>
          {chips.length ? (
            <ul className="no-scrollbar -mx-(--gutter) mt-2.5 flex gap-2 overflow-x-auto px-(--gutter) lg:mx-0 lg:flex-wrap lg:px-0">
              {chips.map((c) => (
                <li key={`${c.key}-${c.v}`}>
                  <button
                    onClick={() => toggle(c.key, c.v)}
                    className="tap inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface ps-3.5 pe-2.5 text-[13px] font-medium ring-1 ring-inset ring-ink/10 transition hover:ring-ink/40"
                    aria-label={t(T.removeFilter, { label: c.label })}
                  >
                    {c.label} <Icon name="close" size={13} />
                  </button>
                </li>
              ))}
              <li>
                <button onClick={clear} className="tap h-9 whitespace-nowrap px-2 text-[13px] font-medium text-muted underline underline-offset-4">
                  {T.clearAll}
                </button>
              </li>
            </ul>
          ) : null}
        </div>

        {results.length ? (
          <ProductGrid products={results} offerAt={count ? null : offerAt} />
        ) : (
          <div className="flex flex-col items-center rounded-[24px] bg-surface px-6 py-14 text-center">
            <p className="text-h3">{T.noMatches}</p>
            <p className="mt-2 text-[15px] text-muted">{T.tryRemove}</p>
            <Button className="mt-6" onClick={clear}>
              {T.reset}
            </Button>
          </div>
        )}
      </div>

      {/* Mobile filter sheet */}
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        side="bottom"
        title={T.title}
        footer={
          <div className="flex gap-2">
            {count ? (
              <Button size="lg" variant="outline" className="shrink-0 px-6" onClick={clear}>
                {T.clear}
              </Button>
            ) : null}
            <Button size="lg" className="flex-1" onClick={() => setSheet(false)}>
              {t(T.show, { pieces: plural(d.common.pieces, results.length) })}
            </Button>
          </div>
        }
      >
        <FilterPanel products={products} f={f} toggle={toggle} />
      </Sheet>
    </div>
  );
}

type FacetKey = "size" | "color" | "price" | "cat";

function FilterPanel({ products, f, toggle }: { products: Product[]; f: FilterState; toggle: (key: FacetKey, value: string) => void }) {
  const { d, color: colorLabel, categoryLabel } = useCollectionI18n();
  const T = d.collection.filters;
  const { sizes, colors, cats } = useMemo(() => facets(products), [products]);
  const countFor = (skip: keyof FilterState, test: (p: Product) => boolean) => applyFilters(products, f, skip).filter(test).length;
  const legend = "mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted";

  return (
    <div className="divide-y divide-line">
      {cats.length > 1 ? (
        <fieldset className="py-5">
          <legend className={legend}>{T.category}</legend>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => {
              const on = f.cat.includes(c);
              const n = countFor("cat", (p) => p.category === c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  disabled={!n && !on}
                  onClick={() => toggle("cat", c)}
                  className={cx(
                    "tap inline-flex h-11 items-center rounded-full px-4 text-[14px] font-medium transition active:scale-95 disabled:opacity-35 lg:h-10 lg:px-3.5 lg:text-[13px]",
                    on ? "bg-ink text-white" : "bg-surface-2 ring-1 ring-inset ring-ink/8 hover:ring-ink/30 lg:bg-surface",
                  )}
                >
                  {categoryLabel(c)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 1 ? (
        <fieldset className="py-5">
          <legend className={legend}>{T.size}</legend>
          <div className="grid grid-cols-6 gap-2 lg:grid-cols-3">
            {sizes.map((s) => {
              const on = f.size.includes(s);
              const n = countFor("size", (p) => p.sizes.some((x) => x.label === s && x.stock > 0));
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("size", s)}
                  disabled={!n && !on}
                  className={cx(
                    "tap h-11 rounded-full text-[13px] font-semibold transition active:scale-95 disabled:opacity-35 lg:h-10",
                    on ? "bg-ink text-white" : "bg-surface-2 ring-1 ring-inset ring-ink/8 hover:ring-ink/30 lg:bg-surface",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {colors.length > 1 ? (
        <fieldset className="py-5">
          <legend className={legend}>{T.colour}</legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-1 gap-y-3">
            {colors.map((c) => {
              const on = f.color.includes(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("color", c.name)}
                  className="tap group flex flex-col items-center gap-1.5 text-center text-[12px] leading-tight"
                >
                  <span
                    className={cx(
                      "size-9 rounded-full transition-[box-shadow,transform] group-active:scale-90",
                      on ? "ring-[1.5px] ring-ink ring-offset-[3px] ring-offset-surface lg:ring-offset-bg" : "ring-1 ring-ink/12 group-hover:ring-ink/40",
                    )}
                    style={{ background: c.hex }}
                    aria-hidden
                  />
                  <span className={on ? "font-semibold text-ink" : "text-ink-2"}>{colorLabel(ownerOf(products, c.name), c.name)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="py-5">
        <legend className={legend}>{T.price}</legend>
        <div className="space-y-1">
          {PRICE_BANDS.map((b) => {
            const n = countFor("price", (p) => p.price >= b.min && p.price <= b.max);
            return (
              <label key={b.value} className={cx("flex min-h-11 cursor-pointer items-center gap-3 text-[14px] lg:min-h-9", !n && !f.price.includes(b.value) && "opacity-40")}>
                <input type="checkbox" checked={f.price.includes(b.value)} onChange={() => toggle("price", b.value)} className="size-[18px] accent-ink" />
                <span className="flex-1">{T.bands[b.value as keyof typeof T.bands] ?? b.label}</span>
                <span className="text-[12px] text-muted tabular-nums">{n}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

/** useI18n() + category labels by raw category key (facet values are the English categories). */
function useCollectionI18n() {
  const L = useI18n();
  return { ...L, categoryLabel: (c: string) => categoryLabel(c, L.locale) };
}

/** A product carrying this colour — its `ar.colors` map holds the merchant's translation. */
const ownerOf = (products: Product[], color: string) => products.find((p) => p.ar?.colors?.[color]) ?? null;
