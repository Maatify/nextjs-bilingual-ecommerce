"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";
import type { Product } from "@/lib/types";
import { fitNote } from "./fit";

/**
 * Pill size boxes: sold-out sizes get a diagonal strike and open an inline
 * notify-me form; "Size guide · Find my size" sit in the label row; one-line
 * review-based fit note underneath.
 */
export function SizeSelector({
  product: p,
  size,
  onSize,
  onHelp,
  error,
}: {
  product: Product;
  size: string | null;
  onSize: (size: string) => void;
  onHelp?: (tab: "finder" | "chart") => void;
  error?: boolean;
}) {
  const L = useI18n();
  const { d, t } = L;
  const T = d.product.size;
  const [notify, setNotify] = useState<string | null>(null);
  const [notified, setNotified] = useState<string[]>([]);
  const [contact, setContact] = useState("");
  if (p.sizes.length === 1) return null;

  const selected = p.sizes.find((s) => s.label === size);
  const note = fitNote(p, L);
  const cols = p.sizes.length >= 6 ? "grid-cols-3 min-[400px]:grid-cols-6" : p.sizes.length === 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[14px] text-muted" id="size-label">
          {T.label} {size ? <span className="ms-1 font-semibold text-ink">{size}</span> : null}
        </p>
        {onHelp ? (
          <p className="flex items-center text-[13px] font-semibold">
            <button type="button" onClick={() => onHelp("chart")} className="tap -my-2 px-1 py-2 underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
              {T.guide}
            </button>
            <span className="px-1 text-muted" aria-hidden>
              ·
            </span>
            <button type="button" onClick={() => onHelp("finder")} className="tap -my-2 flex items-center gap-1 px-1 py-2 underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
              <Icon name="ruler" size={14} /> {T.find}
            </button>
          </p>
        ) : null}
      </div>

      <div role="radiogroup" aria-labelledby="size-label" aria-describedby={error ? "size-error" : undefined} className={cx("grid gap-2", cols)}>
        {p.sizes.map((s) => {
          const on = s.label === size;
          const out = s.stock === 0;
          return (
            <button
              key={s.label}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${s.label}${out ? T.soldOutNotify : s.stock <= 3 ? t(T.onlyLeft, { n: s.stock }) : ""}`}
              onClick={() => (out ? setNotify(notify === s.label ? null : s.label) : (setNotify(null), onSize(s.label)))}
              className={cx(
                "tap relative h-12 min-w-0 overflow-hidden rounded-full text-[14px] font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95",
                on ? "bg-ink text-white" : out ? "bg-surface-2 text-muted" : "bg-surface-2 text-ink ring-1 ring-inset ring-ink/8 hover:ring-ink/40",
                error && !on && "ring-1 ring-sale/50",
                notify === s.label && "ring-2 ring-ink",
              )}
            >
              {out ? (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "linear-gradient(to top right, transparent calc(50% - 0.75px), rgb(16 19 16 / 0.35) 50%, transparent calc(50% + 0.75px))" }}
                  />
                  
                </>
              ) : null}
              <span className="relative">{s.label}</span>
              {!out && s.stock <= 3 ? <span className="absolute inset-e-2.5 top-2 size-1.5 rounded-full bg-sale" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <p id="size-error" role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-sale">
          <Icon name="info" size={15} /> {T.selectError}
        </p>
      ) : null}

      {notify ? (
        notified.includes(notify) ? (
          <p className="mt-3 flex items-center gap-2 rounded-2xl bg-sage-soft px-4 py-3 text-[13px] text-forest" role="status">
            <Icon name="check" size={16} /> {t(T.notifyDone, { size: notify })}
          </p>
        ) : (
          <form
            className="mt-3 rounded-2xl bg-surface-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (contact.trim().length < 6) return;
              setNotified((n) => [...n, notify]);
              setContact("");
            }}
          >
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold">
              <Icon name="mail" size={15} /> {t(T.notifyTitle, { size: notify })}
            </p>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="notify-contact">
                {T.contact}
              </label>
              <input
                id="notify-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={T.contact}
                className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-forest sm:text-[14px]"
              />
              <button className="tap h-11 shrink-0 rounded-full bg-ink px-5 text-[13px] font-semibold text-white transition hover:bg-forest active:scale-95">{T.notifyMe}</button>
            </div>
          </form>
        )
      ) : null}

      {selected && selected.stock > 0 && selected.stock <= 5 ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-sale" aria-live="polite">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-sale opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-sale" />
          </span>
          {t(T.onlyLeftIn, { n: selected.stock, size: selected.label })}
        </p>
      ) : null}

      {note ? (
        <p className="mt-3 text-[13px] text-ink-2">
          {note.text}{" "}
          {onHelp ? (
            <button type="button" onClick={() => onHelp("finder")} className="tap font-semibold text-ink underline underline-offset-4">
              {note.action}
            </button>
          ) : (
            <b className="text-ink">{note.action}</b>
          )}
        </p>
      ) : null}
    </div>
  );
}
