"use client";

import { useI18n } from "@/components/i18n/provider";
import { colorStock } from "@/lib/catalog";
import { cx } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * Colour swatches (Vestra-style): round 44px tap targets with the real garment hex,
 * selected colour name in the label row. Props kept stable for the LP order form.
 */
export function ColorThumbs({ product: p, colorIdx, onChange, idPrefix = "pdp" }: { product: Product; colorIdx: number; onChange: (i: number) => void; idPrefix?: string }) {
  const { d, t, color: label } = useI18n();
  const T = d.product.colour;
  const color = p.colors[colorIdx];
  return (
    <div>
      <p id={`${idPrefix}-color-label`} className="mb-2 text-[14px] text-muted">
        {T.label} <span className="ms-1 font-semibold text-ink">{label(p, color.name)}</span>
        {colorStock(p, color.name) === 0 ? <span className="ms-2 text-[13px] font-medium text-sale">{T.soldOutHere}</span> : null}
      </p>
      <div role="radiogroup" aria-labelledby={`${idPrefix}-color-label`} className="-ms-1.5 flex flex-wrap">
        {p.colors.map((c, i) => {
          const on = i === colorIdx;
          const out = colorStock(p, c.name) === 0;
          return (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${label(p, c.name)}${out ? T.soldOutSuffix : ""}`}
              title={out ? t(T.soldOutTitle, { color: label(p, c.name) }) : label(p, c.name)}
              onClick={() => onChange(i)}
              className="tap group grid size-11 place-items-center rounded-full"
            >
              <span
                className={cx(
                  "relative size-8 overflow-hidden rounded-full transition-[box-shadow,transform,opacity] duration-200 group-active:scale-90",
                  on ? "ring-[1.5px] ring-ink ring-offset-[3px] ring-offset-surface" : "ring-1 ring-ink/12 group-hover:ring-ink/40",
                  out && !on && "opacity-55",
                )}
                style={{ background: c.hex }}
                aria-hidden
              >
                {out ? (
                  <span
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "linear-gradient(to top right, transparent calc(50% - 0.75px), rgb(16 19 16 / 0.55) 50%, transparent calc(50% + 0.75px))" }}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
