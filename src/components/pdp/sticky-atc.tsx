"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState, type RefObject } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { cx } from "@/lib/format";
import type { ColorVariant, Product } from "@/lib/types";

/** Appears once the main CTA has scrolled above the viewport. */
export function StickyAtc({
  product: base,
  color,
  size,
  total,
  target,
  soldOut,
  onAdd,
  onBuy,
  onSize,
}: {
  product: Product;
  color: ColorVariant;
  size: string | null;
  total: number;
  target: RefObject<HTMLElement | null>;
  soldOut: boolean;
  onAdd: (size?: string) => void;
  /** add + go straight to checkout */
  onBuy?: (size?: string) => void;
  onSize: (size: string) => void;
}) {
  const { d, t, money, product, color: colorLabel } = useI18n();
  const T = d.product.sticky;
  const p = product(base);
  const [show, setShow] = useState(false);
  const [picker, setPicker] = useState(false);
  const oneSize = p.sizes.length === 1;

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  // which action the size picker should finish with
  const [intent, setIntent] = useState<"add" | "buy">("add");
  const press = (want: "add" | "buy" = "add") => {
    if (size || oneSize) return want === "buy" ? onBuy?.() : onAdd();
    setIntent(want);
    setPicker(true);
  };

  return (
    <>
      <AnimatePresence>
        {show && !soldOut ? (
          <motion.div
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", damping: 32, stiffness: 360 }}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(max(12px,env(safe-area-inset-bottom))+66px)] z-40 px-3 md:bottom-0 md:px-6 md:pb-5"
          >
            {/* below 420px the photo + title hide and the buttons tighten — at 360–390px the title was squeezed to "H…" and the wrapped
                price ran under the "Buy now" pill */}
            <div className="pointer-events-auto mx-auto flex max-w-[880px] items-center gap-2 rounded-[24px] min-[420px]:gap-3 bg-white/95 p-2 shadow-lift ring-1 ring-ink/5 md:rounded-full md:ps-3">
              <span className="relative hidden h-12 w-[38px] shrink-0 overflow-hidden rounded-xl bg-well min-[420px]:block">
                <Image src={color.images[0]} alt="" fill sizes="48px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1 ps-2 min-[420px]:ps-0">
                <span className="hidden truncate text-[13px] font-semibold min-[420px]:block">{p.title}</span>
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  <b className="whitespace-nowrap text-ink tabular-nums">{money(total)}</b>
                  <span className="hidden sm:inline">· {colorLabel(p, color.name)}</span>
                </span>
              </span>
              {!oneSize && size ? (
                <button
                  onClick={() => setPicker(true)}
                  className={cx("tap flex h-11 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold transition", size ? "bg-surface-2" : "bg-surface-2 text-muted")}
                  aria-label={size ? t(T.changeSize, { size }) : T.choose}
                >
                  {size ?? T.size} <Icon name="chevronDown" size={14} />
                </button>
              ) : null}
              {onBuy ? (
                <button
                  onClick={() => press("buy")}
                  className="tap flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink ring-[1.5px] min-[420px]:px-4 ring-ink transition hover:bg-ink hover:text-white active:scale-95"
                >
                  <Icon name="lock" size={15} className="hidden min-[420px]:block" />
                  {T.buyNow}
                </button>
              ) : null}
              <button
                onClick={() => press("add")}
                className="tap flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-white min-[420px]:px-5 transition hover:bg-forest active:scale-95"
              >
                {size || oneSize ? (
                  <>
                    <Icon name="bag" size={16} />
                    <span>
                      {T.add}
                      <span className="hidden min-[420px]:inline">{T.toBag}</span>
                    </span>
                  </>
                ) : (
                  <span>{T.select}</span>
                )}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Sheet open={picker} onClose={() => setPicker(false)} title={T.sheetTitle} side="bottom" width="md:mx-auto md:max-w-[520px]">
        
        <div className="grid grid-cols-3 gap-2 pb-2">
          {p.sizes.map((s) => (
            <button
              key={s.label}
              disabled={!s.stock}
              onClick={() => {
                onSize(s.label);
                setPicker(false);
                if (intent === "buy" && onBuy) onBuy(s.label);
                else onAdd(s.label);
              }}
              className={cx(
                "tap h-14 rounded-2xl text-[15px] font-semibold transition active:scale-95 disabled:text-muted disabled:line-through",
                s.label === size ? "bg-ink text-white" : "bg-surface-2 hover:bg-ink/10",
              )}
            >
              {s.label}
              {s.stock > 0 && s.stock <= 3 ? <span className="block text-[12px] font-medium text-sale no-underline">{t(T.left, { n: s.stock })}</span> : null}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
