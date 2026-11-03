"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { useIsRtl } from "@/components/fx/media";
import { cx } from "@/lib/format";
import { Icon } from "./icon";

/**
 * Accessible overlay: end-side drawer on desktop (right in English, left in Arabic), bottom sheet on mobile
 * (or forced via `side`). Focus is trapped, Esc closes, body scroll locks,
 * and focus returns to the trigger on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  side = "responsive",
  width = "max-w-[460px]",
  hideHeader,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "bottom" | "responsive" | "center" | "left";
  width?: string;
  hideHeader?: boolean;
}) {
  const reduce = useReducedMotion();
  const { d } = useI18n();
  // "right"/"left" are logical (end/start): in Arabic the bag drawer slides in from the left, the menu from the right
  const rtl = useIsRtl();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // keep the latest onClose without re-running the open/close effect: callers usually pass an
  // inline function, and re-running would restore focus to the opener on every keystroke
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingInlineEnd = `${sbw}px`;
    // `[data-autofocus]` wins (querySelector with a selector list returns the first match in DOM order,
    // which made the search overlay focus its hidden close button instead of the input)
    const t = setTimeout(() => {
      const root = panel.current;
      (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>("button:not([disabled]), a[href], input, select, textarea"))?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key !== "Tab" || !panel.current) return;
      const els = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingInlineEnd = "";
      prev?.focus?.();
    };
  }, [open]);

  const pos = {
    right: "inset-y-0 inset-e-0 h-full w-full rounded-s-[28px]",
    left: "inset-y-0 inset-s-0 h-full w-full rounded-e-[28px]",
    bottom: "inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[28px]",
    center: "inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[28px] md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[86dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]",
    responsive: "inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[28px] md:inset-y-0 md:inset-s-auto md:inset-e-0 md:h-full md:max-h-none md:rounded-s-[28px] md:rounded-se-none",
  }[side];

  const isDesktopSide = side === "right" || side === "left";
  const from = reduce
    ? { opacity: 0 }
    : side === "right"
      ? { x: rtl ? "-100%" : "100%" }
      : side === "left"
        ? { x: rtl ? "100%" : "-100%" }
        : { y: "100%" };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80]" role="presentation">
          {/* plain tinted scrim: a backdrop blur re-filters the whole page under it on every frame of the fade */}
          <motion.div
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cx("absolute flex flex-col bg-surface shadow-lift", pos, width, side === "responsive" && "md:w-full")}
            initial={from}
            animate={{ x: 0, y: 0, opacity: 1 }}
            // opens on a critically-damped spring (transform only), closes on a quick ease-in so it gets out of the way
            exit={{ ...from, transition: { duration: reduce ? 0 : 0.16, ease: [0.4, 0, 1, 1] } }}
            transition={reduce ? { duration: 0 } : { type: "spring", damping: 38, stiffness: 420, mass: 0.8 }}
          >
            {!isDesktopSide ? <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/15 md:hidden" aria-hidden /> : null}
            <div className={cx("flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-3 md:px-6 md:pt-5", hideHeader && "sr-only")}>
              <h2 id={titleId} className="text-h3">
                {title}
              </h2>
              {/* a visually hidden header keeps its title for aria-labelledby, but no invisible tab stop: those sheets show their own close */}
              {hideHeader ? null : (
                <button onClick={onClose} className="tap grid size-10 place-items-center rounded-full bg-surface-2 transition hover:bg-ink/8 active:scale-90" aria-label={d.common.close}>
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6">{children}</div>
            {footer ? <div className="shrink-0 border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 md:px-6">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
