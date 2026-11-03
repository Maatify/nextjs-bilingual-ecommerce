"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { buttonClass, ButtonLink } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { multiBuyRowLabel } from "@/components/ui/offer-chip";
import { bogoLabel, computeTotals } from "@/lib/pricing";
import { actions, useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { CartLineItem } from "./cart-line";
import { RewardsBar } from "./rewards-bar";
import { defaultVariant, pickUpsells } from "./upsells";

export function CartDrawer() {
  const open = useStore((s) => s.cartOpen);
  const cart = useStore((s) => s.cart);
  const promo = useStore((s) => s.promo);
  const pathname = usePathname();
  const { d, t, money, locale } = useI18n();
  const offer = bogoLabel(locale);
  const totals = useMemo(() => computeTotals(cart, { promo }), [cart, promo]);
  const upsells = useMemo(() => pickUpsells(cart, 3), [cart]);
  const merch = totals.subtotal - totals.bogoDiscount - totals.multiDiscount - totals.promoDiscount;

  useEffect(() => actions.setCartOpen(false), [pathname]);

  const close = () => actions.setCartOpen(false);

  return (
    <Sheet
      open={open}
      onClose={close}
      side="responsive"
      title={
        <span className="flex items-baseline gap-2">
          {d.cart.title} {totals.itemCount ? <bdi className="text-[15px] font-medium text-muted tabular-nums">({totals.itemCount})</bdi> : null}
        </span>
      }
      footer={
        totals.itemCount ? (
          <div>
            {totals.bogoDiscount || totals.multiDiscount ? (
              <dl className="mb-2 space-y-1 text-[13px] font-medium text-forest">
                {totals.bogoDiscount ? (
                  <div className="flex justify-between gap-4">
                    <dt>{offer || d.checkout.totals.bundle}</dt>
                    <dd className="tabular-nums">−{money(totals.bogoDiscount)}</dd>
                  </div>
                ) : null}
                {totals.multiDiscount ? (
                  <div className="flex justify-between gap-4">
                    <dt>{multiBuyRowLabel(locale)}</dt>
                    <dd className="tabular-nums">−{money(totals.multiDiscount)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <span className="text-[15px] font-semibold">{d.cart.total}</span>
              <span className="text-end tabular-nums">
                {totals.totalSavings > 0 ? <span className="me-2 text-[13px] font-medium text-forest">{t(d.cart.saved, { amount: money(totals.totalSavings) })}</span> : null}
                <span className="text-[20px] font-semibold tracking-tight">{money(merch)}</span>
              </span>
            </div>
            <Link href="/checkout" onClick={close} className={buttonClass("primary", "lg", "w-full")}>
              {d.cart.checkout} <Icon name="arrowUpRight" size={18} />
            </Link>
            <p className="mt-2.5 text-center text-[12.5px] text-muted">{d.cart.reassurance}</p>
          </div>
        ) : null
      }
    >
      {totals.itemCount === 0 ? (
        <div className="flex flex-col items-center px-2 py-14 text-center">
          <span className="mb-5 grid size-16 place-items-center rounded-full bg-surface-2">
            <Icon name="bag" size={26} />
          </span>
          <p className="text-h3">{d.cart.empty}</p>
          <p className="mt-2 text-[15px] text-muted">{offer ? t(d.cart.emptyOffer, { offer }) : d.cart.emptyDefault}</p>
          <div className="mt-7 flex flex-col gap-2 self-stretch">
            <ButtonLink href="/collections/bestsellers" onClick={close}>
              {d.cart.shopBestsellers} <Icon name="arrowUpRight" size={17} />
            </ButtonLink>
            <ButtonLink href="/collections/all" variant="light" onClick={close}>
              {d.cart.shopAll}
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <RewardsBar totals={totals} />
          <ul className="divide-y divide-line">
            {totals.lines.map((l) => (
              <CartLineItem key={l.key} line={l} compact />
            ))}
          </ul>
          {upsells.length ? <AlsoBought items={upsells} /> : null}
        </>
      )}
    </Sheet>
  );
}

function AlsoBought({ items }: { items: Product[] }) {
  const { d, t, money, product, color, isAr } = useI18n();
  return (
    <section className="mt-2 border-t border-line pt-5" aria-labelledby="also-h">
      <h3 id="also-h" className="mb-3 text-[15px] font-semibold">
        {d.cart.alsoBought}
      </h3>
      <ul className="grid grid-cols-3 gap-2.5">
        {items.map((base) => {
          const u = product(base);
          const v = defaultVariant(u);
          return (
          <li key={u.id} className="min-w-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-well">
              <Link href={`/products/${u.handle}`} aria-label={u.title} className="absolute inset-0">
                <Image src={u.colors[0].images[0]} alt="" fill sizes="(min-width: 768px) 130px, 30vw" className="object-cover" />
              </Link>
              <button
                onClick={() => actions.add({ productId: u.id, ...v }, 1, { open: false })}
                aria-label={t(d.cart.addToBag, { title: u.title, color: color(u, v.color), size: v.size })}
                className="tap absolute bottom-1.5 inset-e-1.5 grid size-10 place-items-center rounded-full bg-ink text-white shadow-soft transition hover:bg-ink/85 active:scale-90"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
            <Link href={`/products/${u.handle}`} className="mt-2 line-clamp-1 block text-[13px] font-medium">
              {isAr ? u.title : u.title.replace(/^Heavyweight /, "")}
            </Link>
            <p className="text-[13px] font-semibold tabular-nums">{money(u.price)}</p>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
