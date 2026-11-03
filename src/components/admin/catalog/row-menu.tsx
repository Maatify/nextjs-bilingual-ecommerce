"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { useT } from "../i18n";
import { AIcon, type AIconName } from "../icons";
import { ease } from "../ui";

export type MenuItem = { label: string; icon: AIconName; onSelect?: () => void; href?: string; external?: boolean; danger?: boolean; disabled?: boolean };

/** Small "⋯" popover menu for row actions. Closes on outside click / Escape. */
export function RowMenu({ items, label }: { items: MenuItem[]; label?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // capture + preventDefault: closes only this menu, not a drawer/modal it sits in
        e.preventDefault();
        setOpen(false);
        btn.current?.focus();
      }
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const cls = (it: MenuItem) =>
    cx(
      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] transition",
      it.disabled ? "pointer-events-none opacity-40" : it.danger ? "text-a-danger hover:bg-a-danger/10" : "text-a-text hover:bg-a-hover",
    );

  return (
    <div ref={ref} className="relative">
      <button
        ref={btn}
        type="button"
        aria-label={label ?? t("common.actions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx("grid size-8 place-items-center rounded-[9px] text-a-dim transition hover:bg-a-panel-2 hover:text-a-text active:scale-95", open && "bg-a-panel-2 text-a-text")}
      >
        <AIcon name="more" size={18} strokeWidth={2.6} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2 }}
            transition={{ duration: 0.16, ease }}
            className="absolute end-0 top-full z-30 mt-1 w-48 origin-top-right rtl:origin-top-left rounded-xl border border-a-line-strong bg-a-panel-2 p-1 shadow-[0_20px_50px_-16px_var(--a-shadow)]"
          >
            {items.map((it) =>
              it.href ? (
                it.external ? (
                  <a key={it.label} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer" className={cls(it)} onClick={() => setOpen(false)}>
                    <AIcon name={it.icon} size={15} className="text-a-dim" />
                    {it.label}
                  </a>
                ) : (
                  <Link key={it.label} role="menuitem" href={it.href} className={cls(it)} onClick={() => setOpen(false)}>
                    <AIcon name={it.icon} size={15} className="text-a-dim" />
                    {it.label}
                  </Link>
                )
              ) : (
                <button
                  key={it.label}
                  role="menuitem"
                  type="button"
                  className={cls(it)}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect?.();
                  }}
                >
                  <AIcon name={it.icon} size={15} className={it.danger ? "" : "text-a-dim"} />
                  {it.label}
                </button>
              ),
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
