"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { getProductById, getProducts, variantStock } from "@/lib/catalog";
import { getContent } from "@/lib/data";
import { cx } from "@/lib/format";
import { localizeContent } from "@/lib/i18n/store/content";
import { bogoGroup, bogoLabel } from "@/lib/pricing";
import { actions } from "@/lib/store";
import type { Product } from "@/lib/types";
import { Dot } from "./shared";

/** Top colour → closest sweatpants colour (exact match where it exists, tonal otherwise). */
const SETS: { id: string; label: "hoodie" | "crewneck"; pairs: [string, string][] }[] = [
  { id: "p01", label: "hoodie", pairs: [["Black", "Black"], ["Sandstone", "Khaki"], ["Bone", "Creme"], ["Navy", "Navy"]] },
  { id: "p02", label: "crewneck", pairs: [["Black", "Black"], ["Dusty Sage", "Sage"], ["Bone", "Creme"], ["Navy", "Navy"]] },
];

const color = (p: Product, name: string) => p.colors.find((c) => c.name === name) ?? p.colors[0];

/** Hoodie/crewneck + sweatpants in one tap — the home page's AOV lever. */
export function MatchingSet() {
  const [setIdx, setSetIdx] = useState(0);
  const [pairIdx, setPairIdx] = useState(0);
  const [size, setSize] = useState("M");
  const [added, setAdded] = useState(false);
  const { d, t, money, locale, product, color: colorLabel } = useI18n();
  const m = d.home.set;

  // Resolved from the live catalog — the section hides itself if the pieces are unpublished.
  const PANTS = getProductById("p05") ?? getProducts().find((p) => p.category === "Sweatpants");
  const sets = SETS.filter((s) => getProductById(s.id));
  const set = sets[Math.min(setIdx, sets.length - 1)];
  const top = set ? getProductById(set.id) : undefined;
  if (!PANTS || !set || !top) return null;
  const title = localizeContent(getContent(), locale).home.setTitle;
  const offer = bogoLabel(locale);
  const topL = product(top);
  const pantsL = product(PANTS);

  const [topColor, pantsColor] = set.pairs[pairIdx];
  const topC = color(top, topColor);
  const pantsC = color(PANTS, pantsColor);
  const sizes = top.sizes.map((s) => ({ label: s.label, ok: variantStock(top, topC.name, s.label) > 0 && variantStock(PANTS, pantsC.name, s.label) > 0 }));
  const sizeOk = sizes.some((s) => s.label === size && s.ok);
  const total = top.price + PANTS.price;
  const was = (top.compareAt ?? top.price) + (PANTS.compareAt ?? PANTS.price);
  const colourLabel = topColor === pantsColor ? colorLabel(top, topColor) : `${colorLabel(top, topColor)} + ${colorLabel(PANTS, pantsColor)}`;

  const add = () => {
    if (!sizeOk) return;
    actions.add({ productId: top.id, color: topC.name, size }, 1, { open: false });
    actions.add({ productId: PANTS.id, color: pantsC.name, size }, 1, { open: true });
    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  };

  return (
    <section className="container-x mt-20 md:mt-32" aria-labelledby="set-h">
      <div className="slant-panel grid gap-6 rounded-[28px] p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-12 md:p-10">
        {/* staggered pair: the second photo stands a little taller, both share the bottom edge */}
        <div className="relative grid grid-cols-2 items-end gap-2 md:gap-3">
          {[
            { c: topC, p: top },
            { c: pantsC, p: PANTS },
          ].map(({ c, p }, i) => (
            <div key={p.id} className={cx("relative overflow-hidden rounded-[20px] bg-well", i === 0 ? "aspect-[4/5]" : "aspect-[4/5.75]")}>
              <Image src={c.images[0]} alt={t(d.home.altIn, { title: product(p).title, color: colorLabel(p, c.name) })} fill sizes="(min-width: 1440px) 380px, (min-width: 768px) 27vw, 45vw" className="object-cover" />
            </div>
          ))}
          <span className="absolute bottom-[38%] left-1/2 grid size-10 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full bg-ink text-white shadow-lift" aria-hidden>
            <Icon name="plus" size={18} />
          </span>
        </div>

        <div className="flex flex-col">
          <Dot className="w-fit">{m.tag}</Dot>
          <h2 id="set-h" className="text-poster mt-4">
            {title}
          </h2>

          <div className="mt-6 flex rounded-full bg-surface-2 p-1" role="radiogroup" aria-label={m.top}>
            {sets.map((s, i) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={i === setIdx}
                onClick={() => {
                  setSetIdx(i);
                  setPairIdx(0);
                }}
                className={cx("tap h-10 flex-1 rounded-full text-[14px] font-semibold transition", i === setIdx ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
              >
                {t(m.plusPants, { label: m[s.label] })}
              </button>
            ))}
          </div>

          <p className="mt-5 text-[13px] text-muted">
            {m.colour} · <span className="font-semibold text-ink">{colourLabel}</span>
          </p>
          <div className="-ms-1 mt-1.5 flex flex-wrap" role="radiogroup" aria-label={m.colour}>
            {set.pairs.map(([tc, bc], i) => (
              <button key={tc} role="radio" aria-checked={i === pairIdx} aria-label={tc === bc ? colorLabel(top, tc) : t(m.with, { a: colorLabel(top, tc), b: colorLabel(PANTS, bc) })} onClick={() => setPairIdx(i)} className="tap grid size-11 place-items-center rounded-full">
                <span
                  className={cx("size-7 overflow-hidden rounded-full transition", i === pairIdx ? "ring-[1.5px] ring-ink ring-offset-2 ring-offset-surface" : "ring-1 ring-ink/15")}
                  style={{ background: `linear-gradient(${locale === "ar" ? 225 : 135}deg, ${color(top, tc).hex} 50%, ${color(PANTS, bc).hex} 50%)` }}
                />
              </button>
            ))}
          </div>

          <p className="mt-4 text-[13px] text-muted">{m.sizeHint}</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={m.size}>
            {sizes.map((s) => (
              <button
                key={s.label}
                role="radio"
                aria-checked={s.label === size}
                disabled={!s.ok}
                onClick={() => setSize(s.label)}
                className={cx(
                  "tap h-11 rounded-full text-[13px] font-semibold transition disabled:text-muted disabled:line-through",
                  s.label === size ? "bg-ink text-white" : "bg-surface-2 hover:ring-1 hover:ring-ink/30",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-baseline gap-2 tabular-nums md:mt-auto md:pt-8">
            <span className="text-[24px] font-semibold tracking-tight">{money(total)}</span>
            <s className="text-[14px] text-muted">{money(was)}</s>
            <span className="text-[13px] font-semibold text-sale">{t(m.save, { amount: money(was - total) })}</span>
          </div>
          <button
            onClick={add}
            disabled={!sizeOk}
            className="tap mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition hover:bg-forest active:scale-[0.98] disabled:bg-ink/30"
          >
            {added ? (
              <>
                <Icon name="check" size={18} /> {m.added}
              </>
            ) : (
              <>
                {m.addBoth} <Icon name="arrowUpRight" size={18} />
              </>
            )}
          </button>
          {offer ? (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
              <Icon name="tag" size={14} className="text-sale" /> {bogoGroup() === 3 ? m.thirdFree : offer}
            </p>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {added ? t(m.addedSr, { a: topL.title, b: pantsL.title }) : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
