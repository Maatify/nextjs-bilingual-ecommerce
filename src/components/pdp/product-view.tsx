"use client";

import { useAnimate } from "motion/react";
import Link from "@/components/i18n/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useIsRtl } from "@/components/fx/media";
import { useI18n } from "@/components/i18n/provider";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button, Price } from "@/components/ui/primitives";
import { getCollection, priceRange, variantPrice, withColorStock } from "@/lib/catalog";
import { bundleTiers } from "@/lib/pricing";
import { actions } from "@/lib/store";
import type { Product } from "@/lib/types";
import { BundleCards } from "./bundle-cards";
import { ColorThumbs } from "./color-thumbs";
import { CompleteTheSet } from "./complete-the-set";
import { FindMySize } from "./find-my-size";
import { Gallery } from "./gallery";
import { ProductDetails } from "./product-details";
import { SizeSelector } from "./size-selector";
import { StickyAtc } from "./sticky-atc";

export const PDP_ADD_EVENT = "vedra:pdp-add";

export interface Preselect {
  color?: string | null;
  size?: string | null;
  qty?: string | null;
}

/** Reads ad deep-link params (?color=&size=&qty=) — must render inside <Suspense>. */
export function ProductViewWithParams({ product }: { product: Product }) {
  const sp = useSearchParams();
  const pre = { color: sp.get("color"), size: sp.get("size"), qty: sp.get("qty") };
  return <ProductView key={`${pre.color}|${pre.size}|${pre.qty}`} product={product} preselect={pre} />;
}

export function resolvePreselect(p: Product, pre: Preselect = {}) {
  const colorIdx = Math.max(0, p.colors.findIndex((c) => c.name.toLowerCase() === pre.color?.toLowerCase()));
  // availability is per colour × size
  const sizeHit = withColorStock(p, p.colors[colorIdx].name).sizes.find((s) => s.label.toLowerCase() === pre.size?.toLowerCase() && s.stock > 0);
  const q = Number(pre.qty);
  return {
    colorIdx,
    size: p.sizes.length === 1 ? p.sizes[0].label : (sizeHit?.label ?? null),
    qty: bundleTiers(variantPrice(p, p.colors[colorIdx].name, sizeHit?.label).price).some((t) => t.qty === q) ? q : 1,
  };
}

export function ProductView({ product: base, preselect }: { product: Product; preselect?: Preselect }) {
  const router = useRouter();
  const { d, t, p: plural, money, href, product, collection: localCollection, color: colorLabel, category } = useI18n();
  const T = d.product.view;
  const rtl = useIsRtl();
  // display copy in the page language — keys (id, handle, colour names, sizes) are unchanged
  const p = product(base);
  const init = resolvePreselect(p, preselect);
  const [colorIdx, setColorIdx] = useState(init.colorIdx);
  const [size, setSize] = useState<string | null>(init.size);
  const [qty, setQty] = useState(init.qty);
  const [sizeError, setSizeError] = useState(false);
  const [finder, setFinder] = useState<{ open: boolean; tab: "finder" | "chart" }>({ open: false, tab: "finder" });
  const [adding, setAdding] = useState(false);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const ctaRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);

  const color = p.colors[colorIdx];
  // the product as seen in the selected colour: sizes[].stock = that colour's variant stock
  const pc = useMemo(() => withColorStock(p, color.name), [p, color.name]);
  const vp = variantPrice(p, color.name, size ?? undefined);
  const range = priceRange(p, color.name);
  const tier = bundleTiers(vp.price).find((t) => t.qty === qty) ?? { total: vp.price * qty };
  const soldOut = pc.sizes.every((s) => s.stock === 0);
  const rawCollection = getCollection(p.collections[0]);
  const collection = rawCollection ? localCollection(rawCollection) : undefined;

  useEffect(() => actions.viewed(p.id), [p.id]);

  const requireSize = () => {
    if (size) return true;
    setSizeError(true);
    sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (scope.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // the "no" shake starts toward the reading-start edge (mirrored in Arabic)
      const k = rtl ? -1 : 1;
      animate(scope.current, { x: [0, -8 * k, 8 * k, -6 * k, 6 * k, -3 * k, 0] }, { duration: 0.42 });
    }
    return false;
  };

  const add = (opts: { checkout?: boolean; withSize?: string } = {}) => {
    if (soldOut) return false;
    const s = opts.withSize ?? size;
    if (!s) return requireSize();
    setAdding(true);
    actions.add({ productId: p.id, color: color.name, size: s }, qty, { open: !opts.checkout });
    setTimeout(() => setAdding(false), 450);
    if (opts.checkout) router.push(href("/checkout"));
    return true;
  };

  // Anything else on the page (e.g. a landing-page CTA) can trigger the same add flow, incl. size validation.
  const onExternalAdd = useEffectEvent(() => add());
  useEffect(() => {
    const h = () => onExternalAdd();
    window.addEventListener(PDP_ADD_EVENT, h);
    return () => window.removeEventListener(PDP_ADD_EVENT, h);
  }, []);

  const pickSize = (s: string) => {
    setSize(s);
    setSizeError(false);
  };

  // switching colour keeps the size only when that colour has it in stock
  const pickColor = (i: number) => {
    setColorIdx(i);
    if (size && p.sizes.length > 1 && !withColorStock(p, p.colors[i].name).sizes.find((x) => x.label === size)?.stock) setSize(null);
  };

  const reassure: [IconName, string][] = [
    ["cash", T.cod],
    ["refresh", T.exchange],
    ["truck", T.delivery],
  ];

  return (
    <>
      <div className="lg:container-x lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-10 lg:pt-6 xl:grid-cols-[minmax(0,1fr)_460px] xl:gap-16">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <Gallery product={p} colorIdx={colorIdx} />
        </div>

        <div id="buy-box" className="relative z-10 -mt-7 rounded-t-[28px] bg-surface px-5 pb-8 pt-6 sm:px-8 lg:mt-0 lg:rounded-[28px] lg:p-8">
          {collection ? (
            <nav aria-label={T.breadcrumb} className="mb-3 hidden lg:block">
              <ol className="flex items-center gap-1 text-[13px] text-muted">
                <li>
                  <Link href={`/collections/${collection.handle}`} className="hover:text-ink">
                    {collection.title}
                  </Link>
                </li>
                <li aria-hidden>
                  <Icon name="chevronRight" size={12} />
                </li>
                <li aria-current="page" className="text-ink-2">
                  {category(p)}
                </li>
              </ol>
            </nav>
          ) : null}

          <h1 className="font-poster text-[clamp(2.25rem,1.7rem+1.6vw,3rem)] leading-[0.95] text-balance">{p.title}</h1>

          {p.reviewCount > 0 ? (
            <a href="#reviews" className="tap mt-2 flex w-fit items-center gap-1.5 text-[14px]">
              <Icon name="star" size={15} filled strokeWidth={0} className="text-ink" />
              <span className="font-semibold tabular-nums">{p.rating.toFixed(1)}</span>
              <span className="text-muted" aria-hidden>
                ·
              </span>
              <span className="text-muted underline decoration-ink/20 underline-offset-4 tabular-nums">
                {plural(d.common.reviews, p.reviewCount)}
              </span>
            </a>
          ) : null}

          {!size && range.min !== range.max ? (
            <p className="mt-3 text-[22px] font-semibold tabular-nums">
              <span className="me-1.5 text-[14px] font-medium text-muted">{T.from}</span>
              {money(range.min)}
            </p>
          ) : (
            <Price price={vp.price} compareAt={vp.compareAt} size="lg" className="mt-3" />
          )}

          <div className="mt-6 space-y-6">
            {p.colors.length > 1 ? <ColorThumbs product={p} colorIdx={colorIdx} onChange={pickColor} /> : null}

            <div ref={sizesRef}>
              <SizeSelector product={pc} size={size} onSize={pickSize} error={sizeError} onHelp={(tab) => setFinder({ open: true, tab })} />
            </div>

            <BundleCards price={vp.price} qty={qty} onQty={setQty} />

            <div ref={ctaRef}>
              <div ref={scope} className="space-y-2">
                <Button size="lg" className="w-full text-[16px]" onClick={() => add()} disabled={soldOut} loading={adding}>
                  {soldOut ? (
                    p.colors.length > 1 ? t(d.product.card.soldOutIn, { color: colorLabel(p, color.name) }) : d.product.card.soldOut
                  ) : size ? (
                    <>
                      {T.addToBag} · <span className="tabular-nums">{money(tier.total)}</span>
                      <Icon name="arrowUpRight" size={18} />
                    </>
                  ) : (
                    T.selectSize
                  )}
                </Button>
                {!soldOut ? (
                  <button
                    type="button"
                    onClick={() => add({ checkout: true })}
                    className="tap flex h-14 w-full items-center justify-center gap-2 rounded-full bg-surface text-[16px] font-semibold text-ink ring-[1.5px] ring-ink transition hover:bg-ink hover:text-white active:scale-[0.98]"
                  >
                    <Icon name="lock" size={17} />
                    {T.buyNow}
                  </button>
                ) : null}
              </div>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {reassure.map(([icon, label]) => (
                  <li key={label} className="flex flex-col items-center gap-1.5 text-center text-[12px] font-medium leading-tight text-ink-2">
                    <Icon name={icon} size={18} className="text-ink" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>


            <CompleteTheSet product={p} colorName={color.name} size={size} />

            <ProductDetails product={p} />
          </div>
        </div>
      </div>

      <FindMySize
        product={pc}
        open={finder.open}
        initialTab={finder.tab}
        onClose={() => setFinder((f) => ({ ...f, open: false }))}
        onSelect={(s) => {
          setFinder((f) => ({ ...f, open: false }));
          if (pc.sizes.find((x) => x.label === s)?.stock) pickSize(s);
        }}
      />

      <StickyAtc product={pc} color={color} size={size} total={tier.total} target={ctaRef} soldOut={soldOut} onAdd={(s) => add({ withSize: s })} onBuy={(s) => add({ withSize: s, checkout: true })} onSize={pickSize} />
    </>
  );
}
