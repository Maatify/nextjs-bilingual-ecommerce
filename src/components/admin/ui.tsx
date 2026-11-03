"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import { FX_SEEN_KEY, pathKey } from "@/components/fx/boot";
import { useFirstOpen } from "@/components/fx/page-transition";
import { Tilt3D } from "@/components/fx/tilt";
import { cx } from "@/lib/format";
import { AIcon, type AIconName } from "./icons";
import { useT } from "./i18n/provider";

/*
 * Admin UI kit — quiet, precise (Linear / Vercel / extension-dashboard language), dark + light themes.
 * Everything here is client-side; pages compose these and call server actions.
 * Colours: only --color-a-* tokens (bg-a-panel, text-a-dim, bg-a-ink/[0.05] for washes…) so both themes work.
 * Direction: logical utilities only (ms/me/ps/pe/start/end) so RTL works.
 */

export const ease = [0.22, 1, 0.36, 1] as const;

/* ───────────── Buttons ───────────── */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const btnBase =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium fx-press transition-[background,color,box-shadow,transform,translate,opacity,filter] duration-150 disabled:pointer-events-none disabled:opacity-45";
const btnVariants: Record<BtnVariant, string> = {
  primary: "a-grad fx-magnetic text-white shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset,0_8px_24px_-10px_rgb(139_116_255/0.7)] hover:brightness-110 hover:shadow-[0_0_0_1px_rgb(255_255_255/0.12)_inset,0_14px_30px_-10px_rgb(139_116_255/0.85)]",
  secondary: "bg-a-panel-2 text-a-text ring-1 ring-a-line hover:bg-a-hover hover:ring-a-line-strong",
  outline: "text-a-text ring-1 ring-a-line-strong hover:bg-a-panel-2",
  ghost: "text-a-dim hover:bg-a-panel-2 hover:text-a-text",
  danger: "bg-a-danger/12 text-a-danger ring-1 ring-a-danger/25 hover:bg-a-danger/20",
};
const btnSizes = { xs: "h-7 px-2.5 text-[12px]", sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-[13.5px]", lg: "h-11 px-5 text-[14px]" };

export function buttonClass(variant: BtnVariant = "secondary", size: keyof typeof btnSizes = "md", extra?: string) {
  return cx(btnBase, btnVariants[variant], btnSizes[size], extra);
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes; icon?: AIconName; iconRight?: AIconName; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} data-magnetic={variant === "primary" ? "0.2" : undefined} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Spinner size={14} /> : icon ? <AIcon name={icon} size={size === "xs" ? 14 : 16} /> : null}
      {children}
      {iconRight ? <AIcon name={iconRight} size={15} /> : null}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", icon, iconRight, className, children, external }: { href: string; variant?: BtnVariant; size?: keyof typeof btnSizes; icon?: AIconName; iconRight?: AIconName; className?: string; children?: React.ReactNode; external?: boolean }) {
  const inner = (
    <>
      {icon ? <AIcon name={icon} size={16} /> : null}
      {children}
      {iconRight ? <AIcon name={iconRight} size={15} /> : null}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)} data-magnetic={variant === "primary" ? "0.2" : undefined}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={buttonClass(variant, size, className)} data-magnetic={variant === "primary" ? "0.2" : undefined}>
      {inner}
    </Link>
  );
}

export function IconBtn({ icon, label, className, size = 32, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: AIconName; label: string; size?: number }) {
  return (
    <button aria-label={label} title={label} className={cx("fx-press relative grid place-items-center rounded-[9px] text-a-dim transition hover:bg-a-panel-2 hover:text-a-text", className)} style={{ width: size, height: size }} {...rest}>
      <AIcon name={icon} size={16} />
    </button>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cx("animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────── Layout ───────────── */

export function PageHeader({ title, description, actions, back, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: React.ReactNode }) {
  const first = useFirstOpen();
  return (
    <motion.header initial={first ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="group mb-3 inline-flex items-center gap-1 text-[12.5px] text-a-dim transition hover:text-a-text">
            <AIcon name="chevronLeft" size={14} className="transition-transform duration-200 group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" /> {back.label}
          </Link>
        ) : null}
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-a-dim">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.header>
  );
}

export function Card({ title, description, actions, children, className, padded = true, glow }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string; padded?: boolean; glow?: boolean }) {
  return (
    <section className={cx("fx-spot relative overflow-hidden rounded-2xl border border-a-line bg-a-panel", glow && "a-glow", className)}>
      {title || actions ? (
        <div className={cx("flex items-start justify-between gap-3", padded ? "px-5 pt-5" : "border-b border-a-line px-5 py-4")}>
          <div className="min-w-0">
            {title ? <h2 className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</h2> : null}
            {description ? <p className="mt-1 text-[12.5px] leading-relaxed text-a-dim">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cx(padded && "p-5", padded && (title || actions) ? "pt-4" : null)}>{children}</div>
    </section>
  );
}

/** Stagger children in on mount. Wrap lists/grids of cards. */
export function Stagger({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const first = useFirstOpen();
  return (
    <motion.div className={className} initial={first ? "hidden" : false} animate="show" variants={{ show: { transition: { staggerChildren: 0.035, delayChildren: delay } } }}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // opacity/transform only: a filter/blur per card meant a re-raster of every card on every frame of the cascade
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } } }}>
      {children}
    </motion.div>
  );
}

/* ───────────── Data display ───────────── */

export type Tone = "neutral" | "violet" | "green" | "amber" | "red" | "blue" | "pink";
const tones: Record<Tone, string> = {
  neutral: "bg-a-ink/[0.06] text-a-dim ring-a-ink/[0.08]",
  violet: "bg-a-violet/15 text-a-accent ring-a-violet/25",
  green: "bg-a-ok/12 text-a-ok ring-a-ok/20",
  amber: "bg-a-warn/12 text-a-warn ring-a-warn/20",
  red: "bg-a-danger/12 text-a-danger ring-a-danger/20",
  blue: "bg-a-blue/12 text-a-blue ring-a-blue/20",
  pink: "bg-a-pink/12 text-a-pink ring-a-pink/20",
};

export function Badge({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset", tones[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  // count up from 0 on a page's first open only; on a revisit start at the value (later changes still tween)
  const mv = useMotionValue(useFirstOpen() ? 0 : value);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 1.1, ease });
    return () => c.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref} className={cx("tabular-nums", className)}>{text}</motion.span>;
}

/** Tiny trend line. `color` is any CSS colour; it's darkened automatically on the light theme. */
export function Sparkline({ data, className, color = "#b4a5ff" }: { data: number[]; className?: string; color?: string }) {
  const id = useId();
  const first = useFirstOpen();
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 30 - ((v - min) / (max - min || 1)) * 26 - 2]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cx("a-tone h-10 w-full", className)} style={{ "--tone": color } as React.CSSProperties} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={`${d} L100,30 L0,30 Z`} fill={`url(#${id})`} initial={first ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
      <motion.path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={first ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
    </svg>
  );
}

/** KPI tile: spotlight + subtle 3D tilt on hover. `tone` is any CSS colour (auto-darkened on light). */
export function Stat({ label, value, format, delta, icon, spark, tone = "#b4a5ff", hint }: { label: string; value: number; format?: (n: number) => string; delta?: number | null; icon?: AIconName; spark?: number[]; tone?: string; hint?: string }) {
  return (
    <Tilt3D max={6} scale={1.012} className="h-full rounded-2xl">
      <div className="fx-spot group relative h-full overflow-hidden rounded-2xl border border-a-line bg-a-panel p-4 transition-[border-color,box-shadow] duration-300 hover:border-a-line-strong hover:shadow-[0_18px_40px_-24px_var(--a-shadow)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[12.5px] text-a-dim">
            {icon ? (
              <span className="a-tone grid size-6 place-items-center rounded-md bg-[color-mix(in_oklab,var(--tone)_14%,transparent)] transition-transform duration-300 group-hover:-translate-y-px group-hover:scale-110" style={{ "--tone": tone } as React.CSSProperties}>
                <AIcon name={icon} size={14} />
              </span>
            ) : null}
            {label}
          </span>
          {delta !== undefined && delta !== null ? (
            <span className={cx("inline-flex items-center gap-0.5 text-[11.5px] font-medium", delta >= 0 ? "text-a-ok" : "text-a-danger")}>
              <AIcon name={delta >= 0 ? "trendUp" : "trendDown"} size={13} />
              {Math.abs(delta).toFixed(1)}%
            </span>
          ) : null}
        </div>
        <div className="mt-3 whitespace-nowrap text-[clamp(19px,1.55vw,26px)] font-semibold tracking-[-0.02em]">
          <AnimatedNumber value={value} format={format} />
        </div>
        {hint ? <p className="mt-0.5 text-[12px] text-a-faint">{hint}</p> : null}
        {spark ? <Sparkline data={spark} color={tone} className="mt-2 -mb-1" /> : null}
      </div>
    </Tilt3D>
  );
}

export function EmptyState({ icon = "sparkle", title, description, action }: { icon?: AIconName; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-a-line bg-a-panel-2 text-a-accent">
        <AIcon name={icon} size={20} />
      </span>
      <p className="mt-4 text-[14.5px] font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-[42ch] text-[13px] text-a-dim">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-a-ink/[0.06]", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-a-line-strong bg-a-panel-2 px-1 font-sans text-[10.5px] text-a-dim">{children}</kbd>;
}

/** Table shell — use with <thead>/<tbody> of plain rows; styling via these classes. */
export const table = {
  wrap: "overflow-x-auto a-scroll",
  table: "w-full min-w-[640px] border-collapse text-start text-[13px]",
  th: "sticky top-0 z-[1] border-b border-a-line bg-a-panel px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint",
  tr: "border-b border-a-line/70 transition-colors duration-200 last:border-0 hover:bg-a-violet/[0.045]",
  td: "px-4 py-3 align-middle",
};

/* ───────────── Forms ───────────── */

export function Field({ label, hint, error, children, className, htmlFor, aside }: { label?: React.ReactNode; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string; aside?: React.ReactNode }) {
  return (
    <div className={cx("min-w-0", className)}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-a-dim">
            {label}
          </label>
          {aside}
        </div>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 text-[12px] text-a-danger">{error}</p> : hint ? <p className="mt-1.5 text-[12px] leading-relaxed text-a-faint">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "h-9 w-full rounded-[10px] border border-a-line bg-a-panel-2 px-3 text-[13.5px] text-a-text placeholder:text-a-faint transition outline-none hover:border-a-line-strong focus:border-a-violet/70 focus:ring-[3px] focus:ring-a-violet/20 disabled:opacity-50";

export function Input({ className, prefix, suffix, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> & { prefix?: React.ReactNode; suffix?: React.ReactNode }) {
  if (!prefix && !suffix) return <input className={cx(inputClass, className)} {...rest} />;
  return (
    // numbers/emails/urls are forced LTR (admin-i18n.css) — keep the affixes on the same side as the text
    <div className={cx("relative flex items-center", className)} dir={rest.type && ["number", "tel", "email", "url"].includes(rest.type) ? "ltr" : undefined}>
      {prefix ? <span className="pointer-events-none absolute start-3 text-[12.5px] text-a-faint">{prefix}</span> : null}
      <input className={cx(inputClass, prefix ? "ps-11" : "", suffix ? "pe-10" : "")} {...rest} />
      {suffix ? <span className="pointer-events-none absolute end-3 text-[12.5px] text-a-faint">{suffix}</span> : null}
    </div>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, "h-auto min-h-[88px] resize-y py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx("relative", className)}>
      <select className={cx(inputClass, "appearance-none pe-9")} {...rest}>
        {children}
      </select>
      <AIcon name="chevronDown" size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-a-faint" />
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean }) {
  const btn = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative h-[22px] w-[38px] shrink-0 rounded-full p-[3px] transition-colors duration-200 disabled:opacity-40", checked ? "a-grad" : "bg-a-ink/[0.12]")}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 34 }} className={cx("block size-4 rounded-full bg-white shadow", checked ? "ms-auto" : "")} />
    </button>
  );
  if (!label) return btn;
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-[12.5px] leading-relaxed text-a-dim">{description}</span> : null}
      </span>
      {btn}
    </label>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
      <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className={cx("grid size-[18px] place-items-center rounded-[5px] ring-1 transition", checked ? "a-grad text-white ring-transparent" : "bg-a-panel-2 ring-a-line-strong")}>
        <AnimatePresence>{checked ? <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}><AIcon name="check" size={13} strokeWidth={2.4} /></motion.span> : null}</AnimatePresence>
      </button>
      {label}
    </label>
  );
}

/** Segmented tabs with a sliding indicator. */
export function Tabs<T extends string>({ value, onChange, items, className, size = "md" }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode; count?: number }[]; className?: string; size?: "sm" | "md" }) {
  const id = useId();
  return (
    <div className={cx("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-a-line bg-a-panel p-1 a-scroll", className)} role="tablist">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={active} onClick={() => onChange(it.value)} className={cx("relative flex shrink-0 items-center gap-1.5 rounded-[9px] font-medium transition-colors", size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]", active ? "text-a-text" : "text-a-dim hover:text-a-text")}>
            {active ? <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-[9px] bg-a-hover ring-1 ring-a-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} /> : null}
            <span className="relative">{it.label}</span>
            {it.count !== undefined ? <span className="relative rounded-full bg-a-ink/[0.07] px-1.5 text-[11px] tabular-nums text-a-dim">{it.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── Overlays ───────────── */

/**
 * Overlays render into the admin theme root (outside the page-transition wrapper), so a
 * transformed/filtered ancestor can never trap their `position: fixed`. Server render → inline.
 */
const noopSubscribe = () => () => {};
function useOverlayRoot() {
  return useSyncExternalStore(
    noopSubscribe,
    () => document.querySelector<HTMLElement>(".admin[data-theme]") ?? document.body,
    () => null,
  );
}
function Overlay({ children }: { children: React.ReactNode }) {
  const root = useOverlayRoot();
  return root ? createPortal(children, root) : <>{children}</>;
}

/**
 * Dialog focus management: moves focus into `ref` when `open` turns true (an [autofocus] child wins,
 * else the panel itself), traps Tab/Shift+Tab inside, closes on Escape (topmost dialog only) and
 * restores focus to the opener on close. Runs once per open — never per render.
 */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
// recent focus history, so the opener is known even when an [autofocus] child grabbed focus during commit
const focusHistory: HTMLElement[] = [];
if (typeof document !== "undefined")
  document.addEventListener(
    "focusin",
    (e) => {
      if (!(e.target instanceof HTMLElement)) return;
      focusHistory.push(e.target);
      if (focusHistory.length > 12) focusHistory.shift();
    },
    true,
  );
export function useDialogFocus(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose?: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const outside = (e: Element | null) => !!e && e !== document.body && e.isConnected && !ref.current?.contains(e);
    const active = document.activeElement;
    const opener = outside(active) ? (active as HTMLElement) : active && ref.current?.contains(active) ? ([...focusHistory].reverse().find(outside) ?? null) : null;
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((e) => e.getClientRects().length > 0 && !e.closest("[inert]"));
    const topmost = () => {
      const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      return !!ref.current && all[all.length - 1]?.contains(ref.current);
    };
    const raf = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      (root.querySelector<HTMLElement>("[autofocus],[data-autofocus]") ?? root).focus({ preventScroll: true });
    });
    const key = (e: KeyboardEvent) => {
      const root = ref.current;
      if (!root || e.defaultPrevented || !topmost()) return;
      if (e.key === "Escape") {
        if (!close.current) return;
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      const a = document.activeElement;
      let to: HTMLElement | null = null;
      if (!list.length) to = root;
      else if (!root.contains(a) || a === root) to = e.shiftKey ? list[list.length - 1] : list[0];
      else if (e.shiftKey && a === list[0]) to = list[list.length - 1];
      else if (!e.shiftKey && a === list[list.length - 1]) to = list[0];
      if (!to) return;
      e.preventDefault();
      to.focus({ preventScroll: !list.length });
    };
    window.addEventListener("keydown", key);
    // the panel stays mounted through its exit animation, so it is still the right node at cleanup
    const panel = ref.current;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key);
      const a = document.activeElement;
      const lost = !a || a === document.body || !!panel?.contains(a);
      if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}

export function Modal({ open, onClose, title, description, children, footer, width = "max-w-lg" }: { open: boolean; onClose: () => void; title?: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; width?: string }) {
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(open, panel, onClose);
  return (
    <Overlay>
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
          {/* plain scrim (no backdrop blur: it re-filters the whole dashboard under it on every frame) */}
          <motion.div className="absolute inset-0 bg-a-scrim/65" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.18 }} onClick={onClose} />
          <motion.div
            ref={panel}
            tabIndex={-1}
            className={cx("relative w-full origin-[50%_30%] overflow-hidden outline-none rounded-2xl border border-a-line-strong bg-a-panel shadow-[0_30px_80px_-20px_var(--a-shadow)]", width)}
            // transform/opacity only: springs in, gets out of the way fast
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.13, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.7 }}
          >
            {title ? (
              <div className="flex items-start justify-between gap-4 border-b border-a-line px-5 py-4">
                <div>
                  <h2 id={titleId} className="text-[15px] font-semibold">{title}</h2>
                  {description ? <p className="mt-1 text-[12.5px] text-a-dim">{description}</p> : null}
                </div>
                <IconBtn icon="close" label={t("common.close")} onClick={onClose} />
              </div>
            ) : null}
            <div className="max-h-[70dvh] overflow-y-auto p-5 a-scroll">{children}</div>
            {footer ? <div className="flex items-center justify-end gap-2 border-t border-a-line bg-a-panel-2/50 px-5 py-3">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
    </Overlay>
  );
}

export function Drawer({ open, onClose, title, children, footer, width = "max-w-[520px]" }: { open: boolean; onClose: () => void; title?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; width?: string }) {
  const { t, isRtl: rtl } = useT();
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  useDialogFocus(open, panel, onClose);
  return (
    <Overlay>
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <motion.div className="absolute inset-0 bg-a-scrim/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.aside
            ref={panel}
            tabIndex={-1}
            className={cx("absolute inset-y-0 end-0 flex w-full flex-col outline-none border-s border-a-line-strong bg-a-panel shadow-[0_0_80px_-20px_var(--a-shadow)]", width)}
            initial={{ x: rtl ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: rtl ? "-100%" : "100%", transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
          >
            <div className="flex items-center justify-between border-b border-a-line px-5 py-4">
              <h2 id={titleId} className="text-[15px] font-semibold">{title}</h2>
              <IconBtn icon="close" label={t("common.close")} onClick={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto p-5 a-scroll">{children}</div>
            {footer ? <div className="flex items-center justify-end gap-2 border-t border-a-line px-5 py-3">{footer}</div> : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
    </Overlay>
  );
}

/** Two-step destructive action: first click arms it, second confirms. */
export function ConfirmButton({ onConfirm, children, confirmLabel, size = "sm", variant = "danger", icon = "trash" }: { onConfirm: () => void | Promise<void>; children?: React.ReactNode; confirmLabel?: string; size?: keyof typeof btnSizes; variant?: BtnVariant; icon?: AIconName }) {
  const { t } = useT();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size={size}
      variant={armed ? "danger" : variant}
      icon={icon}
      loading={busy}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
    >
      {armed ? (confirmLabel ?? t("common.clickToConfirm")) : (children ?? t("common.delete"))}
    </Button>
  );
}

/* ───────────── Toasts ───────────── */

type ToastT = { id: number; tone: "ok" | "error" | "info"; title: string; body?: string };
let toasts: ToastT[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function push(t: Omit<ToastT, "id">) {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { ...t, id }].slice(-4);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    emit();
  }, 3800);
}
export const toast = {
  success: (title: string, body?: string) => push({ tone: "ok", title, body }),
  error: (title: string, body?: string) => push({ tone: "error", title, body }),
  info: (title: string, body?: string) => push({ tone: "info", title, body }),
};
const EMPTY: ToastT[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[90] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96, rotateX: 18, transformPerspective: 800 }} animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3, ease }} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-a-line-strong bg-a-panel-2/95 p-3.5 shadow-[0_20px_50px_-20px_var(--a-shadow)] backdrop-blur">
            <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", t.tone === "ok" ? "bg-a-ok/15 text-a-ok" : t.tone === "error" ? "bg-a-danger/15 text-a-danger" : "bg-a-violet/20 text-a-accent")}>
              <AIcon name={t.tone === "ok" ? "check" : t.tone === "error" ? "alert" : "info"} size={12} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[12.5px] text-a-dim">{t.body}</p> : null}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Mark a path as already opened this session (shared with fx/page-transition), so a save that moves the
 * editor to its new URL (new product → /products/id, renamed page slug) doesn't replay the page-open animation.
 */
export function markOpened(path: string) {
  try {
    const k = pathKey(path);
    const s = JSON.parse(sessionStorage.getItem(FX_SEEN_KEY) || "[]") as string[];
    if (Array.isArray(s) && !s.includes(k)) sessionStorage.setItem(FX_SEEN_KEY, JSON.stringify([...s, k].slice(-200)));
  } catch {}
}

/* ───────────── Contextual save bar (Shopify pattern) ───────────── */

/**
 * Shows a floating "Unsaved changes" bar while `dirty`. Pages keep a draft in
 * state, compare to the saved value, and pass save/discard handlers.
 */
/** `guard` (default: dirty) adds the "leave page?" prompt — pass false where the bar shows without real edits (e.g. a blank new product). */
export function SaveBar({ dirty, saving, onSave, onDiscard, label, guard = dirty }: { dirty: boolean; saving?: boolean; onSave: () => void; onDiscard: () => void; label?: string; guard?: boolean }) {
  const { t } = useT();
  useEffect(() => {
    if (!dirty) return;
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    const leave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("keydown", k);
    if (guard) window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("beforeunload", leave);
    };
  }, [dirty, guard, onSave]);
  return (
    <AnimatePresence>
      {dirty ? (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 36 }} className="fixed inset-x-0 bottom-4 z-[70] mx-auto flex w-[min(560px,calc(100vw-2rem))] items-center justify-between gap-3 rounded-2xl border border-a-line-strong bg-a-panel-2/95 py-2.5 ps-4 pe-2.5 shadow-[0_24px_60px_-20px_var(--a-shadow)] backdrop-blur md:start-[248px]">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-a-warn/70" />
              <span className="relative size-2 rounded-full bg-a-warn" />
            </span>
            {label ?? t("common.unsavedChanges")}
            <span className="hidden text-a-faint sm:inline" dir="ltr">
              · <Kbd>⌘</Kbd> <Kbd>S</Kbd>
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onDiscard} disabled={saving}>
              {t("common.discard")}
            </Button>
            <Button size="sm" variant="primary" onClick={onSave} loading={saving}>
              {t("common.save")}
            </Button>
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Draft state helper for editors: returns [draft, setDraft, dirty, reset]. */
export function useDraft<T>(saved: T) {
  const [draft, setDraft] = useState<T>(saved);
  // compare by value: router.refresh() hands us a new (but equal) object — that must not wipe the draft
  const savedKey = JSON.stringify(saved);
  const [baseKey, setBaseKey] = useState(savedKey);
  if (baseKey !== savedKey) {
    // server data really changed (after save + refresh) — adopt it
    setBaseKey(savedKey);
    setDraft(saved);
  }
  const dirty = JSON.stringify(draft) !== savedKey;
  return [draft, setDraft, dirty, () => setDraft(saved)] as const;
}

/* ───────────── Misc ───────────── */

const AdminCtx = createContext<{ currency: string }>({ currency: "EGP" });
export const useAdmin = () => useContext(AdminCtx);
export const AdminProvider = AdminCtx.Provider;

export const egp = (n: number) => `EGP ${Math.round(n).toLocaleString("en")}`;

/** @deprecated in translated UI — use `useT().fmt.ago(iso)` (locale-aware). Kept for English-only callers. */
export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ───────────── Theme (dark / light / system) ───────────── */

export type AdminTheme = "dark" | "light" | "system";
export const ADMIN_THEME_COOKIE = "verda_admin_theme";
const ThemeCtx = createContext<{ theme: AdminTheme; setTheme: (t: AdminTheme, origin?: { x: number; y: number }) => void }>({ theme: "dark", setTheme: () => {} });
export const useAdminTheme = () => useContext(ThemeCtx);

type VTDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };

/**
 * The `.admin` root. The server reads the cookie and passes `initial`, so the first paint already has
 * the right palette (no flash). Switching persists the cookie and, where supported, reveals the new
 * theme with a circular View Transition growing from the pointer.
 */
export function AdminThemeRoot({ initial, className, children, lang, dir }: { initial: AdminTheme; className?: string; children: React.ReactNode; lang?: string; dir?: "rtl" | "ltr" }) {
  const [theme, setState] = useState<AdminTheme>(initial);
  const setTheme = useCallback((next: AdminTheme, origin?: { x: number; y: number }) => {
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const doc = document as VTDoc;
    const apply = () => flushSync(() => setState(next));
    if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    const root = document.documentElement;
    const x = origin?.x ?? innerWidth - 80;
    const y = origin?.y ?? 30;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("a-theme-vt");
    const vt = doc.startViewTransition(apply);
    vt.ready
      .then(() => {
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" });
      })
      .catch(() => {});
    vt.finished.finally(() => root.classList.remove("a-theme-vt"));
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return (
    <ThemeCtx.Provider value={value}>
      <div className={cx("admin", className)} data-theme={theme} lang={lang} dir={dir}>
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
