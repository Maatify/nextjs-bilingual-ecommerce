"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { OfferChip, pctOffLabel } from "@/components/ui/offer-chip";
import { QtyStepper } from "@/components/ui/primitives";
import { multiBuy } from "@/lib/pricing";
import { variantStock } from "@/lib/catalog";
import { enabledPayments, type PaymentMethod } from "@/lib/checkout";
import { cx } from "@/lib/format";
import type { PricedLine } from "@/lib/pricing";
import { actions } from "@/lib/store";

export function CartLineItem({ line, compact }: { line: PricedLine; compact?: boolean }) {
  const { d, t, money, product, color: colorLabel, locale } = useI18n();
  const L = d.cart.line;
  const p = product(line.product);
  const color = p.colors.find((c) => c.name === line.color) ?? p.colors[0];
  const multiSize = p.sizes.length > 1;
  // stock is per colour × size variant
  const stock = variantStock(p, color.name, line.size);
  const struck = line.freeUnits || line.multiOff || line.compareUnit > line.unit;
  const mb = multiBuy();

  return (
    <li className="flex gap-4 py-4">
      <Link href={`/products/${p.handle}`} className={cx("relative aspect-[4/5] shrink-0 overflow-hidden rounded-2xl bg-well", compact ? "w-[88px] max-[359px]:w-[72px]" : "w-[104px] max-[359px]:w-[80px] md:w-[120px]")}>
        <Image src={color.images[0]} alt={t(L.imageAlt, { title: p.title, color: colorLabel(p, color.name) })} fill sizes={compact ? "88px" : "120px"} loading={compact ? "lazy" : "eager"} className="object-cover" />
        {line.freeUnits ? <span className="absolute inset-s-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[12px] font-bold text-white">{line.freeUnits === line.qty ? L.free : t(L.freeUnits, { n: line.freeUnits })}</span> : line.multiOff && mb ? <OfferChip size="xs" className="absolute inset-s-1.5 top-1.5">{pctOffLabel(mb.pct, locale)}</OfferChip> : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/products/${p.handle}`} className="line-clamp-2 text-[15px] font-semibold leading-snug">
            {p.title}
          </Link>
          <button onClick={() => actions.remove(line.key)} aria-label={t(L.remove, { title: p.title })} className="tap -me-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full ring-1 ring-ink/15" style={{ background: color.hex }} aria-hidden /> {colorLabel(p, color.name)}
          </span>
          {multiSize ? (
            <label className="relative inline-flex items-center">
              <span className="sr-only">{L.size}</span>
              <select
                value={line.size}
                data-line-key={line.key}
                onChange={(e) => {
                  // the line's React key is its variant, so the row remounts with the new size — keep keyboard focus on its select
                  const scope = e.currentTarget.closest("ul") ?? document;
                  const next = `${line.productId}|${line.color}|${e.target.value}`;
                  actions.changeVariant(line.key, line.color, e.target.value);
                  requestAnimationFrame(() => scope.querySelector<HTMLSelectElement>(`select[data-line-key="${CSS.escape(next)}"]`)?.focus());
                }}
                className="tap h-8 cursor-pointer appearance-none rounded-full bg-surface-2 ps-3 pe-7 text-[13px] font-medium text-ink"
              >
                {p.sizes.map((s) => {
                  const n = variantStock(p, color.name, s.label);
                  return (
                    <option key={s.label} value={s.label} disabled={!n}>
                      {s.label}
                      {!n ? L.soldOutOption : ""}
                    </option>
                  );
                })}
              </select>
              <Icon name="chevronDown" size={12} className="pointer-events-none absolute inset-e-2.5" />
            </label>
          ) : null}
          {stock > 0 && stock <= 3 && stock >= line.qty ? <span className="text-[12px] font-medium text-sale">{t(L.onlyLeft, { n: stock })}</span> : null}
          {stock < line.qty ? <span className="text-[12px] font-medium text-sale">{stock ? t(L.reduce, { n: stock }) : L.soldOut}</span> : null}
        </div>
        {/* wraps on Fold-width phones, where the stepper and a 5-figure price don't fit side by side */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <QtyStepper size="sm" value={line.qty} min={0} max={Math.min(10, Math.max(stock, line.qty))} onChange={(n) => actions.setQty(line.key, n)} />
          <div className="text-end tabular-nums">
            {struck ? <s className="block text-[12px] text-muted">{money(line.compareUnit * line.qty)}</s> : null}
            <span className="text-[15px] font-semibold">{line.total === 0 ? L.free : money(line.total)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

/** `method`: the admin payment toggle a mark belongs to — marks for switched-off methods are hidden. */
const MARKS: { label: string; method: PaymentMethod; node: React.ReactNode; className?: string }[] = [
  { label: "Visa", method: "card", node: <span className="text-[11px] font-black italic tracking-tight text-[#1a1f71]">VISA</span> },
  {
    label: "Mastercard", method: "card",
    node: (
      <span className="flex -space-x-1.5" aria-hidden>
        <span className="size-3.5 rounded-full bg-[#eb001b]" />
        <span className="size-3.5 rounded-full bg-[#f79e1b] mix-blend-multiply" />
      </span>
    ),
  },
  { label: "Meeza", method: "card", node: <span className="text-[11px] font-bold text-[#5b2d90]">meeza</span> },
  { label: "Apple Pay", method: "card", node: <span className="text-[9px] font-bold tracking-tight text-white">Apple Pay</span>, className: "bg-ink ring-ink" },
  { label: "Vodafone Cash", method: "wallet", node: <span className="grid size-4 place-items-center rounded-full bg-[#e60000] text-[9px] font-black text-white">V</span> },
  { label: "Orange Cash", method: "wallet", node: <span className="text-[10px] font-bold text-black">orange</span>, className: "bg-[#ff7900] ring-[#ff7900]" },
  { label: "e& money", method: "wallet", node: <span className="text-[12px] font-bold text-[#e00800]">e&amp;</span> },
  { label: "valU", method: "installments", node: <span className="text-[11px] font-bold text-[#1aa59b]">valU</span> },
  { label: "InstaPay", method: "wallet", node: <span className="text-[9.5px] font-bold text-[#4b1f73]">InstaPay</span> },
];

/** Payment method marks (styled wordmarks, no third-party image requests). */
export function PaymentMarks({ className, withCod = true }: { className?: string; withCod?: boolean }) {
  const { d } = useI18n();
  const on = enabledPayments();
  return (
    <ul className={cx("flex flex-wrap items-center justify-center gap-1.5", className)} aria-label={d.cart.payments.accepted}>
      {withCod && on.includes("cod") ? (
        <li title={d.cart.payments.cod} className="grid h-7 place-items-center rounded-md bg-white px-2 text-[12px] font-bold text-forest ring-1 ring-line">
          {d.cart.payments.codShort}
        </li>
      ) : null}
      {MARKS.filter((m) => on.includes(m.method)).map((m) => (
        <li key={m.label} dir="ltr" title={m.label} aria-label={m.label} className={cx("grid h-7 w-11 place-items-center rounded-md ring-1", m.className ?? "bg-white ring-line")}>
          {m.node}
        </li>
      ))}
    </ul>
  );
}
