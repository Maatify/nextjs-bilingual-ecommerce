"use client";

import Image from "next/image";
import { useI18n } from "@/components/i18n/provider";
import { cx } from "@/lib/format";
import { formatNumber } from "@/lib/i18n/store/config";
import type { PricedLine, Totals } from "@/lib/pricing";
import { multiBuyRowLabel } from "@/components/ui/offer-chip";
import { bogoLabel } from "@/lib/pricing";
import { getOffer } from "@/lib/site";

/** Compact line list (thumbnail + qty bubble), Shopify-checkout style. */
export function SummaryLines({ lines, extra }: { lines: PricedLine[]; extra?: { title: string; image: string; price: number; note?: string } | null }) {
  const { d, t, money, product, color: colorLabel } = useI18n();
  const T = d.checkout.totals;
  return (
    <ul className="space-y-4">
      {lines.map((l) => {
        const color = l.product.colors.find((c) => c.name === l.color) ?? l.product.colors[0];
        const p = product(l.product);
        return (
          <li key={l.key} className="flex items-center gap-3.5">
            <span className="relative shrink-0">
              <span className="relative block aspect-[4/5] w-14 overflow-hidden rounded-xl bg-well">
                <Image src={color.images[0]} alt="" fill sizes="56px" className="object-cover" />
              </span>
              <span className="absolute -inset-e-2 -top-2 grid size-[22px] place-items-center rounded-full bg-ink text-[11px] font-bold text-white tabular-nums" aria-label={t(T.qty, { n: l.qty })}>
                {l.qty}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{p.title}</span>
              <span className="block text-[13px] text-muted">
                {colorLabel(p, l.color)}
                {l.product.sizes.length > 1 ? ` / ${l.size}` : ""}
              </span>
              {l.freeUnits ? <span className="text-[12px] font-semibold text-forest">{t(T.freeUnits, { n: l.freeUnits })}</span> : null}
            </span>
            <span className="text-end text-[14px] font-medium tabular-nums">
              {l.freeUnits || l.multiOff ? <s className="block text-[12px] text-muted">{money(l.unit * l.qty)}</s> : null}
              {l.total === 0 ? T.free : money(l.total)}
            </span>
          </li>
        );
      })}
      {extra ? (
        <li className="flex items-center gap-3.5">
          <span className="relative block aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-xl bg-well">
            <Image src={extra.image} alt="" fill sizes="56px" className="object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{extra.title}</span>
            {extra.note ? <span className="text-[12px] font-semibold text-forest">{extra.note}</span> : null}
          </span>
          <span className="text-[14px] font-medium tabular-nums">{money(extra.price)}</span>
        </li>
      ) : null}
    </ul>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: "save" | "muted"; strong?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4", tone === "save" && "text-forest", strong && "text-[17px] font-semibold")}>
      <dt className={cx(!tone && !strong && "text-ink-2")}>{label}</dt>
      {/* an amount never splits ("−EGP" / "7,950"); the label wraps instead */}
      <dd className="whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}

/** Totals breakdown — every discount is its own visible line so savings are legible. */
export function TotalsList({ totals, shippingKnown = true, shippingHint, className }: { totals: Totals; shippingKnown?: boolean; shippingHint?: string; className?: string }) {
  const { d, t, money, locale, isAr } = useI18n();
  const T = d.checkout.totals;
  const OFFER = getOffer();
  return (
    <div className={className}>
      <dl className="space-y-2 text-[15px]">
        <Row label={t(T.subtotal, { n: totals.itemCount })} value={money(totals.subtotal)} />
        {totals.bogoDiscount ? <Row label={bogoLabel(locale) || T.bundle} value={`−${money(totals.bogoDiscount)}`} tone="save" /> : null}
        {totals.multiDiscount ? <Row label={multiBuyRowLabel(locale)} value={`−${money(totals.multiDiscount)}`} tone="save" /> : null}
        {totals.promoDiscount ? <Row label={T.discountCode} value={`−${money(totals.promoDiscount)}`} tone="save" /> : null}
        {totals.prepaidDiscount ? <Row label={t(T.onlinePayment, { pct: OFFER.prepaidDiscountPct })} value={`−${money(totals.prepaidDiscount)}`} tone="save" /> : null}
        {totals.bump ? <Row label={T.addedOffer} value={money(totals.bump)} /> : null}
        <Row label={T.shipping} value={totals.freeShipping ? T.free : shippingKnown ? money(totals.shipping) : (shippingHint ?? T.atCheckout)} tone={totals.freeShipping ? "save" : undefined} />
        {totals.protection ? <Row label={T.protection} value={money(totals.protection)} /> : null}
        {totals.gift ? <Row label={OFFER.giftName} value={T.free} tone="save" /> : null}
      </dl>
      <dl className="mt-4 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[17px] font-semibold">{T.total}</dt>
          <dd className="text-end">
            {/* "EGP 1,590" in English · "1,590 ج.م" in Arabic */}
            {isAr ? null : <span className="me-1.5 text-[12px] text-muted">EGP</span>}
            <span className="text-[24px] font-semibold tracking-tight tabular-nums">{formatNumber(Math.round(totals.total))}</span>
            {isAr ? <span className="ms-1.5 text-[13px] text-muted">ج.م</span> : null}
          </dd>
        </div>
      </dl>
      {totals.totalSavings > 0 ? (
        <p className="mt-2 text-end text-[13px] font-semibold text-forest tabular-nums">{t(T.youSave, { amount: money(totals.totalSavings) })}</p>
      ) : null}
    </div>
  );
}
