"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { MediaPicker } from "../media-picker";
import { Button, ease, IconBtn, inputClass } from "../ui";
import { Sortable } from "./sortable";
import type { ProductOption } from "./types";

/* ───────────── Tag list (ribbons, short phrase lists) ───────────── */

export function TagList({ value, onChange, placeholder, max = 12, label, lang }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; label: string; /** "ar" for Arabic store copy (RTL inputs) */ lang?: "ar" }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const langProps = lang === "ar" ? ({ dir: "rtl", lang: "ar" } as const) : {};
  const add = () => {
    const next = text.trim();
    if (!next || value.length >= max) return;
    onChange([...value, next]);
    setText("");
  };
  return (
    <div className="rounded-xl border border-a-line bg-a-panel-2/60 p-2">
      <Sortable
        items={value}
        onChange={onChange}
        label={label}
        className="flex flex-col gap-1"
        render={(item, h) => (
          <div className="group flex items-center gap-1 rounded-lg border border-a-line bg-a-panel px-1 py-0.5">
            {h.handle}
            <input
              aria-label={`${label} ${h.index + 1}`}
              value={item}
              {...langProps}
              onChange={(e) => onChange(value.map((x, i) => (i === h.index ? e.target.value : x)))}
              className="h-8 min-w-0 flex-1 bg-transparent px-1 text-[13px] outline-none"
            />
            <IconBtn icon="close" label={t("content.fields.removeItem", { name: item })} size={28} onClick={h.remove} className="opacity-60 group-hover:opacity-100" />
          </div>
        )}
      />
      <div className={cx("flex items-center gap-1.5", value.length > 0 && "mt-1.5")}>
        <input
          aria-label={t("content.fields.newItem", { label })}
          value={text}
          {...langProps}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={value.length >= max ? t("content.fields.maxPhrases", { max }) : (placeholder ?? t("content.fields.addPhrase"))}
          disabled={value.length >= max}
          className={cx(inputClass, "h-8 bg-transparent text-[13px]")}
        />
        <Button size="sm" icon="plus" onClick={add} disabled={!text.trim() || value.length >= max}>
          {t("common.add")}
        </Button>
      </div>
    </div>
  );
}

/* ───────────── Product select with image + price ───────────── */

export function ProductSelect({ value, onChange, products, placeholder, allowNone }: { value: string; onChange: (id: string) => void; products: ProductOption[]; placeholder?: string; allowNone?: boolean }) {
  const { t } = useT();
  const statusLabel = (s: string) => (s === "draft" ? t("common.draft") : s === "archived" ? t("common.archived") : s === "active" ? t("common.active") : s);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const current = products.find((p) => p.id === value);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const list = useMemo(() => products.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase())), [products, q]);

  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cx(inputClass, "flex h-12 items-center gap-3 px-2 text-start")}>
        {current ? (
          <>
            <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-[#f1f1ee]">{current.image ? <Image src={current.image} alt="" fill sizes="36px" className="object-cover" /> : null}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{current.title}</span>
              <span className="block text-[12px] text-a-dim">
                <bdi dir="ltr">EGP {current.price.toLocaleString("en")}</bdi>
                {current.status !== "active" ? ` · ${statusLabel(current.status)}` : ""}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 px-1 text-a-faint">{value ? t("content.fields.missingProduct", { id: value }) : (placeholder ?? t("content.fields.chooseProduct"))}</span>
        )}
        <AIcon name="chevronDown" size={15} className={cx("me-1 text-a-faint transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16, ease }} className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-a-line-strong bg-a-panel-2 shadow-[0_24px_60px_-18px_var(--a-shadow)]">
            <div className="flex items-center gap-2 border-b border-a-line px-3">
              <AIcon name="search" size={14} className="text-a-faint" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("content.fields.searchProducts")} aria-label={t("content.fields.searchProducts")} className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-a-faint" />
            </div>
            <ul role="listbox" className="a-scroll max-h-72 overflow-y-auto p-1.5">
              {allowNone ? (
                <li>
                  <button type="button" role="option" aria-selected={!value} onClick={() => (onChange(""), setOpen(false))} className="w-full rounded-lg px-2.5 py-2 text-start text-[13px] text-a-dim hover:bg-a-ink/[0.05]">
                    {t("common.none")}
                  </button>
                </li>
              ) : null}
              {list.map((p) => (
                <li key={p.id}>
                  <button type="button" role="option" aria-selected={p.id === value} onClick={() => (onChange(p.id), setOpen(false), setQ(""))} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start hover:bg-a-ink/[0.05]">
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-[#f1f1ee]">{p.image ? <Image src={p.image} alt="" fill sizes="36px" className="object-cover" /> : null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{p.title}</span>
                      <bdi dir="ltr" className="block text-start text-[11.5px] text-a-dim">EGP {p.price.toLocaleString("en")}</bdi>
                    </span>
                    {p.status !== "active" ? <span className="text-[11px] text-a-warn">{statusLabel(p.status)}</span> : null}
                    {p.id === value ? <AIcon name="check" size={14} className="text-a-accent" /> : null}
                  </button>
                </li>
              ))}
              {list.length === 0 ? <li className="px-3 py-6 text-center text-[12.5px] text-a-dim">{t("content.fields.noProductsMatch")}</li> : null}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ───────────── Image list (MediaPicker + reorder) ───────────── */

export function ImageList({ value, onChange, max = 6, hint }: { value: string[]; onChange: (v: string[]) => void; max?: number; hint?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Sortable
        items={value}
        onChange={onChange}
        axis="x"
        label={t("content.fields.image")}
        className="flex flex-wrap gap-2.5"
        render={(src, h) => (
          <div className="group relative w-[92px]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f1f1ee] ring-1 ring-a-line">
              <Image src={src} alt="" fill sizes="92px" className="pointer-events-none object-cover" />
              {h.index === 0 ? <span className="absolute start-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">LCP</span> : null}
              <button type="button" aria-label={t("content.fields.removeImage", { n: h.index + 1 })} onClick={h.remove} className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
                <AIcon name="close" size={12} strokeWidth={2.2} />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-a-faint">
              <span className="tabular-nums" dir="ltr">#{h.index + 1}</span>
              {h.handle}
            </div>
          </div>
        )}
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <Button size="sm" icon="media" onClick={() => setOpen(true)} disabled={value.length >= max}>
          {value.length ? t("content.fields.addImages") : t("content.fields.chooseImages")}
        </Button>
        <span className="text-[12px] text-a-faint">{hint ?? t("content.fields.imagesHint", { count: value.length, max })}</span>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} multiple productShot onSelect={(urls) => onChange([...value, ...urls.filter((u) => !value.includes(u))].slice(0, max))} />
    </div>
  );
}

/** Small character counter used beside labels. */
export function Counter({ value, max, ideal }: { value: string; max: number; ideal?: [number, number] }) {
  const n = value.length;
  const tone = n > max ? "text-a-danger" : ideal && n >= ideal[0] && n <= ideal[1] ? "text-a-ok" : "text-a-faint";
  return (
    <span dir="ltr" className={cx("text-[11.5px] tabular-nums transition-colors", tone)}>
      {n}/{max}
    </span>
  );
}

/** Card look-alike without overflow clipping, so popovers (link/product pickers) can escape it. */
export function Panel({ title, description, actions, children, className }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cx("relative rounded-2xl border border-a-line bg-a-panel", className)}>
      {title || actions ? (
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title ? <h2 className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</h2> : null}
            {description ? <p className="mt-1 text-[12.5px] leading-relaxed text-a-dim">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cx("p-5", (title || actions) ? "pt-4" : null)}>{children}</div>
    </section>
  );
}
