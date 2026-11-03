"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useMemo } from "react";
import { CartLineItem } from "@/components/cart/cart-line";
import { RewardsBar } from "@/components/cart/rewards-bar";
import { defaultVariant, pickUpsells } from "@/components/cart/upsells";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { buttonClass, ButtonLink } from "@/components/ui/primitives";
import { bogoLabel, computeTotals } from "@/lib/pricing";
import { actions, useStore } from "@/lib/store";
import { PromoField } from "./promo-field";
import { TotalsList } from "./summary";

export function CartView() {
  const { d, t, money, locale, product, color } = useI18n();
  const offer = bogoLabel(locale);
  const hydrated = useStore((s) => s.hydrated);
  const cart = useStore((s) => s.cart);
  const promo = useStore((s) => s.promo);
  const totals = useMemo(() => computeTotals(cart, { promo }), [cart, promo]);
  const upsells = useMemo(() => pickUpsells(cart, 3), [cart]);
  const merch = totals.subtotal - totals.bogoDiscount - totals.multiDiscount - totals.promoDiscount;

  // distinct keys: React must not morph the skeleton's <div> into the empty-state <div> (that resize counted as a
  // layout shift, CLS 0.16 on desktop); a fresh node in the same place doesn't
  if (!hydrated) {
    return (
      <div key="skeleton" className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-10" aria-busy="true" aria-label={d.cart.loading}>
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-[20px] bg-surface" />
          <div className="h-80 animate-pulse rounded-[28px] bg-surface" />
        </div>
        <div className="h-72 animate-pulse rounded-[28px] bg-surface" />
      </div>
    );
  }

  if (!totals.itemCount) {
    return (
      <div key="empty" className="mx-auto flex max-w-md flex-col items-center rounded-[28px] bg-surface px-5 py-14 text-center md:py-20">
        <span className="mb-6 grid size-16 place-items-center rounded-full bg-surface-2">
          <Icon name="bag" size={26} />
        </span>
        <h2 className="text-h2">{d.cart.empty}</h2>
        <p className="mt-2 text-[16px] text-muted">{offer ? t(d.cart.emptyOffer, { offer }) : d.cart.emptyDefault}</p>
        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink href="/collections/bestsellers">
            {d.cart.shopBestsellers} <Icon name="arrowUpRight" size={17} />
          </ButtonLink>
          <ButtonLink href="/collections/all" variant="light">
            {d.cart.shopAll}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* phones: one column capped at the screen width (the promo field otherwise widened it past the edge) */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
        <div className="min-w-0 rounded-[28px] bg-surface p-5 md:p-8">
          <RewardsBar totals={totals} />
          <ul className="divide-y divide-line">
            {totals.lines.map((l) => (
              <CartLineItem key={l.key} line={l} />
            ))}
          </ul>
        </div>

        <aside className="rounded-[28px] bg-surface p-5 md:p-8 lg:sticky lg:top-[calc(var(--header-h)+24px)]" aria-label={d.cart.orderSummary}>
          <h2 className="mb-4 text-h3">{d.cart.summary}</h2>
          <PromoField discount={totals.promoDiscount} merch={totals.subtotal - totals.bogoDiscount - totals.multiDiscount} className="mb-2" />
          <TotalsList totals={totals} shippingKnown={false} />
          <Link href="/checkout" className={buttonClass("primary", "lg", "mt-5 hidden w-full md:flex")}>
            {d.cart.checkout} <Icon name="arrowUpRight" size={18} />
          </Link>
          <p className="mt-3 text-center text-[13px] text-muted">{d.cart.reassurance}</p>
        </aside>
      </div>

      {upsells.length ? (
        <section className="mt-16 md:mt-28" aria-labelledby="cart-upsell">
          <h2 id="cart-upsell" className="text-poster mb-6 md:mb-8">
            {d.cart.alsoBought}
          </h2>
          <ul className="grid grid-cols-3 gap-2.5 md:gap-5">
            {upsells.map((base) => {
              const u = product(base);
              const v = defaultVariant(u);
              return (
              <li key={u.id} className="min-w-0">
                <Link href={`/products/${u.handle}`} className="relative block aspect-[4/5] overflow-hidden rounded-[20px] bg-well">
                  <Image src={u.colors[0].images[0]} alt={u.title} fill sizes="(min-width: 1440px) 460px, 31vw" className="object-cover transition duration-700 ease-[var(--ease-out-soft)] hover:scale-[1.03]" />
                </Link>
                <div className="mt-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-[13px] font-semibold md:text-[15px]">{u.title}</p>
                    <p className="text-[13px] tabular-nums md:text-[15px]">{money(u.price)}</p>
                  </div>
                  <button
                    onClick={() => actions.add({ productId: u.id, ...v }, 1, { open: false })}
                    aria-label={t(d.cart.addToBag, { title: u.title, color: color(u, v.color), size: v.size })}
                    className="tap grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white transition hover:bg-ink/85 active:scale-90"
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Sticky mobile checkout bar */}
      {/* sits just above the mobile tab bar, which stays visible on the cart page; the spacer keeps the
          end of the page scrollable out from under it */}
      <div aria-hidden className="h-28 md:hidden" />
      <div className="fixed inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+68px)] z-[45] rounded-[22px] bg-surface px-4 py-3 shadow-lift ring-1 ring-line md:hidden">
        <Link href="/checkout" className={buttonClass("primary", "lg", "w-full")}>
          {/* gap + nowrap: on 280px phones the label and total ran together ("CheckoutEGP 16,900") */}
          <span className="flex w-full items-center justify-between gap-3 max-[359px]:text-[14px]">
            <span>{d.cart.checkout}</span>
            <span className="whitespace-nowrap tabular-nums">{money(merch)}</span>
          </span>
        </Link>
        <p className="mt-2 text-center text-[12.5px] text-muted">{d.cart.reassurance}</p>
      </div>
    </>
  );
}
