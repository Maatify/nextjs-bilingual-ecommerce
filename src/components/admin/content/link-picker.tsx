"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";
import type { LinkTarget } from "./types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { ease, inputClass } from "../ui";

/**
 * URL input with a searchable picker of every store destination
 * (collections, content pages, products). Free-typing any URL still works.
 */
const STORE_KEYS: Record<string, "home" | "search" | "wishlist" | "cart" | "track"> = { "/": "home", "/search": "search", "/wishlist": "wishlist", "/cart": "cart", "/track-order": "track" };

export function LinkInput({ value, onChange, targets, placeholder = "/collections/all", className, ariaLabel }: { value: string; onChange: (href: string, label?: string) => void; targets: LinkTarget[]; placeholder?: string; className?: string; ariaLabel?: string }) {
  const { t, locale } = useT();
  /** display name in the dashboard language (the English label is still what gets inserted into English menus) */
  const shown = (x: LinkTarget) => (x.group === "Store" && STORE_KEYS[x.href] ? t(`content.link.store.${STORE_KEYS[x.href]}`) : locale === "ar" && x.labelAr ? x.labelAr : x.label);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return targets.filter((x) => !s || x.label.toLowerCase().includes(s) || (x.labelAr ?? "").includes(s) || x.href.toLowerCase().includes(s)).slice(0, 60);
  }, [q, targets]);
  const match = targets.find((x) => x.href === value);
  const known = !value || !!match || /^(https?:|mailto:|tel:|#)/.test(value);

  const pick = (x: LinkTarget) => {
    onChange(x.href, x.label);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={box} className={cx("relative", className)}>
      <div className="relative flex items-center">
        <AIcon name={known ? "globe" : "alert"} size={14} className={cx("pointer-events-none absolute start-3", known ? "text-a-faint" : "text-a-warn")} />
        <input aria-label={ariaLabel ?? t("content.link.label")} dir="ltr" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, "ps-8 pe-9 text-start font-mono text-[12.5px] rtl:pe-8 rtl:ps-9 rtl:text-end")} title={known ? (match ? shown(match) : undefined) : t("content.link.unknown")} />
        <button
          type="button"
          aria-label={t("content.link.choose")}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            setOpen((o) => !o);
            setActive(0);
            requestAnimationFrame(() => search.current?.focus());
          }}
          className={cx("absolute end-1 grid size-7 place-items-center rounded-md text-a-dim transition hover:bg-a-ink/[0.06] hover:text-a-text", open && "bg-a-ink/[0.06] text-a-text")}
        >
          <AIcon name="chevronDown" size={15} className={cx("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.16, ease }} className="absolute inset-x-0 top-[calc(100%+6px)] z-40 min-w-[260px] origin-top overflow-hidden rounded-xl border border-a-line-strong bg-a-panel-2 shadow-[0_24px_60px_-18px_var(--a-shadow)]">
            <div className="flex items-center gap-2 border-b border-a-line px-3">
              <AIcon name="search" size={14} className="text-a-faint" />
              <input
                ref={search}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, list.length - 1)));
                  else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
                  else if (e.key === "Enter" && list[active]) (e.preventDefault(), pick(list[active]));
                  else if (e.key === "Escape") setOpen(false);
                }}
                placeholder={t("content.link.search")}
                className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-a-faint"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={list[active] ? `${listId}-${active}` : undefined}
              />
            </div>
            <ul id={listId} role="listbox" className="a-scroll max-h-72 overflow-y-auto p-1.5">
              {list.length === 0 ? <li className="px-3 py-6 text-center text-[12.5px] text-a-dim">{t("content.link.nothing", { q })}</li> : null}
              {list.map((x, i) => (
                <li key={`${x.group}-${x.href}`}>
                  {i === 0 || list[i - 1].group !== x.group ? <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-a-faint">{t(`content.link.groups.${x.group}`)}</p> : null}
                  <button
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={x.href === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(x)}
                    className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-[13px] transition-colors", i === active ? "bg-a-ink/[0.06] text-a-text" : "text-a-dim")}
                  >
                    {x.image ? (
                      <span className="relative size-7 shrink-0 overflow-hidden rounded-md bg-[#f1f1ee]">
                        <Image src={x.image} alt="" fill sizes="28px" className="object-cover" />
                      </span>
                    ) : (
                      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-a-line bg-a-panel text-a-faint">
                        <AIcon name={x.group === "Pages" ? "pages" : x.group === "Collections" ? "collections" : "store"} size={13} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{shown(x)}</span>
                    <span dir="ltr" className="hidden truncate font-mono text-[11px] text-a-faint sm:block">{x.href}</span>
                    {x.href === value ? <AIcon name="check" size={14} className="text-a-accent" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
