"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { completeTheLook, variantPrice, variantStock, withColorStock } from "@/lib/catalog";
import { cx } from "@/lib/format";
import { actions } from "@/lib/store";
import type { Product } from "@/lib/types";

/**
 * One compact "Complete the set" card (hoodie/crewneck ⇄ sweatpants, tee ⇄ shorts).
 * Picks the matching colour when the partner piece has it, and adds in one tap when
 * the shopper's size is already chosen and in stock — otherwise a size sheet opens.
 */
export function CompleteTheSet({ product, colorName, size }: { product: Product; colorName: string; size: string | null }) {
  const { d, t, money, product: localize, color: colorLabel } = useI18n();
  const T = d.product.set;
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState(false);
  const raw = completeTheLook(product, 1)[0];
  if (!raw) return null;
  const mate = localize(raw);

  const color = mate.colors.find((c) => c.name === colorName) ?? mate.colors[0];
  const matches = color.name === colorName;
  const cname = colorLabel(mate, color.name);
  const href = `/products/${mate.handle}?color=${encodeURIComponent(color.name)}`;

  const add = (s: string) => {
    actions.add({ productId: mate.id, color: color.name, size: s }, 1, { open: false });
    actions.toast({ title: T.addedToBag, body: `${mate.title} · ${cname} · ${s}`, image: color.images[0] });
    setAdded(true);
    setPicking(false);
  };
  const quickAdd = () => {
    const hit = mate.sizes.find((s) => s.label === size && variantStock(mate, color.name, s.label) > 0);
    if (hit) add(hit.label);
    else setPicking(true);
  };

  return (
    <section aria-labelledby="set-h" className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5 pe-3">
      <Link href={href} className="relative aspect-[4/5] w-[60px] shrink-0 overflow-hidden rounded-xl bg-well" aria-label={t(d.product.card.imageAlt, { title: mate.title, color: cname })}>
        <Image src={color.images[0]} alt="" fill sizes="60px" loading="lazy" className="object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <p id="set-h" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
          {T.title}
        </p>
        <Link href={href} className="mt-0.5 block truncate text-[14px] font-semibold hover:underline hover:underline-offset-4">
          {mate.title}
        </Link>
        <p className="text-[13px] text-muted tabular-nums">
          {money(variantPrice(mate, color.name).price)}
          {matches ? ` · ${cname}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={quickAdd}
        aria-label={added ? t(T.addedAria, { title: mate.title }) : t(size ? T.addAriaSize : T.addAria, { title: mate.title, color: cname, size })}
        className={cx(
          "tap inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition active:scale-95",
          added ? "bg-forest text-white" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-ink hover:text-white",
        )}
      >
        <Icon name={added ? "check" : "plus"} size={15} strokeWidth={2.2} />
        {added ? T.added : T.add}
      </button>

      <Sheet open={picking} onClose={() => setPicking(false)} title={t(T.sizeTitle, { title: mate.title })} side="bottom" width="md:mx-auto md:max-w-[520px]">
        <div className="grid grid-cols-3 gap-2 pb-2">
          {withColorStock(mate, color.name).sizes.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={!s.stock}
              onClick={() => add(s.label)}
              className="tap h-12 rounded-full bg-surface-2 text-[15px] font-semibold ring-1 ring-inset ring-ink/8 transition hover:bg-ink hover:text-white active:scale-95 disabled:text-muted disabled:line-through disabled:hover:bg-surface-2 disabled:hover:text-muted"
            >
              {s.label}
            </button>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
