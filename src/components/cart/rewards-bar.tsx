"use client";

import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";
import { multiBuy, type Totals } from "@/lib/pricing";
import { getOffer } from "@/lib/site";

/**
 * One calm perks meter: a single line telling the shopper the next thing to unlock,
 * over two slim tracks — free shipping (continuous) and Buy 2 Get 1 (3 steps).
 * Both fill from the reading-start edge (the width bar is start-anchored; the steps follow grid order), so RTL mirrors itself.
 */
export function RewardsBar({ totals, className }: { totals: Totals; className?: string }) {
  const { d, t, money } = useI18n();
  const OFFER = getOffer();
  const merch = totals.subtotal - totals.bogoDiscount - totals.multiDiscount - totals.promoDiscount;
  const mb = multiBuy();
  const shipPct = Math.min(100, (merch / OFFER.freeShippingAt) * 100);
  const bogo = totals.bogoEnabled;
  const group = OFFER.bogo.buy + OFFER.bogo.get;
  const inGroup = !bogo ? 0 : totals.itemCount % group === 0 ? (totals.itemCount ? group : 0) : totals.itemCount % group;
  const bogoDone = bogo && totals.bogoDiscount > 0 && totals.itemCount % group === 0;

  const R = d.cart.rewards;
  const amt = <b className="tabular-nums">{money(OFFER.freeShippingAt - merch)}</b>;
  // splits a dictionary sentence around {token} placeholders so parts can be bold
  const rich = (s: string, parts: Record<string, React.ReactNode>) =>
    s.split(/(\{\w+\})/).map((chunk, i) => {
      const k = /^\{(\w+)\}$/.exec(chunk)?.[1];
      return k && k in parts ? <span key={i}>{parts[k]}</span> : chunk;
    });
  const toShip = rich(R.toFreeShipping, { amount: amt });

  const pct = mb ? <b className="tabular-nums">{mb.pct}%</b> : null;
  // items in the current (incomplete) group: the multi-buy kicks in at mb.qty, the free piece at the full group
  const partial = bogo ? totals.itemCount % group : totals.itemCount;
  const msg = mb && totals.itemCount > 0 && partial === mb.qty - 1 && (!bogo || mb.qty < group)
    ? rich(R.addOneMulti, { one: <b>{R.oneMore}</b>, pct })
    : mb && bogo && partial === mb.qty && totals.toNextFree === 1 && mb.qty === group - 1
    ? rich(R.multiUnlocked, { pct, one: <b>{R.oneMore}</b>, free: <b>{R.free}</b> })
    : !bogo
    ? !totals.freeShipping
      ? toShip
      : R.freeShippingUnlocked
    : !bogoDone && totals.toNextFree === 1
    ? rich(R.addOneFree, { one: <b>{R.oneMore}</b>, free: <b>{R.free}</b> })
    : !totals.freeShipping
      ? toShip
      : !bogoDone
        ? rich(R.shippingAndAdd, { n: <b className="tabular-nums">{totals.toNextFree}</b> })
        : R.allUnlocked;

  return (
    <div className={cx("rounded-[20px] bg-surface-2 px-4 py-3.5", className)}>
      <p className="text-[14px] leading-snug" aria-live="polite">
        {msg}
      </p>
      <div className={cx("mt-3 grid gap-3", bogo ? "grid-cols-[1.4fr_1fr]" : "grid-cols-1")}>
        <Track label={R.freeShipping} done={totals.freeShipping}>
          <div className="h-1 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-label={R.shippingProgress} aria-valuemin={0} aria-valuemax={OFFER.freeShippingAt} aria-valuenow={Math.min(merch, OFFER.freeShippingAt)}>
            <div className="h-full rounded-full bg-ink transition-[width] duration-700 ease-[var(--ease-out-soft)]" style={{ width: `${shipPct}%` }} />
          </div>
        </Track>
        {bogo ? (
          <Track label={mb && mb.qty < group ? t(R.multiTrack, { qty: mb.qty, pct: `${mb.pct}%`, group }) : t(R.bogoTrack, { buy: OFFER.bogo.buy, get: OFFER.bogo.get })} done={bogoDone}>
            <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${group}, minmax(0, 1fr))` }} aria-label={t(R.towardFree, { n: inGroup, group })}>
              {Array.from({ length: group }, (_, i) => (
                <li key={i} className={cx("h-1 rounded-full transition-colors duration-500", i < inGroup ? "bg-ink" : "bg-ink/10")} />
              ))}
            </ol>
          </Track>
        ) : null}
      </div>
    </div>
  );
}

function Track({ label, done, children }: { label: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      {children}
      <p className={cx("mt-1.5 flex items-center gap-1 text-[12px] font-medium", done ? "text-ink" : "text-muted")}>
        {done ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
        {label}
      </p>
    </div>
  );
}
