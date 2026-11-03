"use client";

import { useI18n } from "@/components/i18n/provider";
import { OfferChip } from "@/components/ui/offer-chip";
import { cx } from "@/lib/format";
import { bogoLabel, bundleTiers } from "@/lib/pricing";

/**
 * Quantity breaks as three compact tiles (1 · 2 · 3 = one free).
 * The offer is explained once, in the legend. Props-driven for reuse on landing pages.
 */
export function BundleCards({ price, qty, onQty, name = "bundle" }: { price: number; qty: number; onQty: (q: number) => void; name?: string }) {
  const { d, t, p: plural, money, locale } = useI18n();
  const T = d.product.bundle;
  const tiers = bundleTiers(price, locale);
  const offer = bogoLabel(locale);
  return (
    <fieldset>
      <legend className="mb-4 text-[14px] text-muted">
        {offer ? (
          <>
            <b className="font-semibold text-ink">{offer}</b> {T.mixPieces}
          </>
        ) : (
          <>
            <b className="font-semibold text-ink">{T.choose}</b> {T.mixColours}
          </>
        )}
      </legend>
      <div className={cx("grid gap-2", tiers.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {tiers.map((tier) => {
          const on = qty === tier.qty;
          return (
            <label
              key={tier.qty}
              className={cx(
                "tap relative flex cursor-pointer flex-col items-center rounded-2xl px-2 pb-2.5 pt-3 text-center transition-[background-color,box-shadow,color] duration-200",
                on ? "bg-ink text-white" : "bg-surface-2 ring-1 ring-inset ring-ink/8 hover:ring-ink/30",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest",
              )}
            >
              <input type="radio" name={name} value={tier.qty} checked={on} onChange={() => onQty(tier.qty)} className="sr-only" />
              {tier.badge ? (
                <OfferChip size="xs" className="absolute -top-2.5 shadow-soft">{tier.badge}</OfferChip>
              ) : tier.popular && tier.total < price * tier.qty ? (
                <span className="absolute -top-2 rounded-full bg-amber px-2 py-px text-[12px] font-bold uppercase tracking-wide text-ink">{t(T.free, { n: tier.qty - Math.round(tier.total / price) })}</span>
              ) : null}
              <span className="text-[14px] font-semibold">{plural(d.common.pieces, tier.qty)}</span>
              <span className="mt-0.5 text-[13px] tabular-nums">{money(tier.total)}</span>
              <span className={cx("mt-0.5 text-[12px] tabular-nums", on ? "text-white/70" : "text-muted")}>
                {tier.qty === 1 ? T.standard : t(T.each, { price: money(Math.round(tier.total / tier.qty)) })}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
