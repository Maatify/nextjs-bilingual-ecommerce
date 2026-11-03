"use client";

import Link from "@/components/i18n/link";
import { useI18n } from "@/components/i18n/provider";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx, pctOff } from "@/lib/format";
import { Icon } from "./icon";

type Variant = "primary" | "forest" | "outline" | "ghost" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "tap relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[transform,background-color,color,box-shadow,opacity] duration-200 ease-[var(--ease-out-soft)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/85 shadow-[0_1px_0_rgb(255_255_255/0.08)_inset]",
  forest: "bg-forest text-white hover:bg-forest-2",
  outline: "border border-ink/12 bg-surface text-ink hover:border-ink/35",
  ghost: "text-ink hover:bg-ink/5",
  light: "bg-white text-ink hover:bg-surface-2",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-12 px-6 text-[15px]",
  lg: "h-14 px-8 text-base",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cx(base, variants[variant], sizes[size], extra);

export function Button({ variant = "primary", size = "md", className, loading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" aria-hidden /> : null}
      <span className={cx("inline-flex items-center gap-2", loading && "opacity-80")}>{children}</span>
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      className={cx(
        "tap inline-grid size-11 place-items-center rounded-full text-ink transition-[background-color,transform] duration-200 hover:bg-ink/6 active:scale-90",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Price({ price, compareAt, size = "md", className }: { price: number; compareAt?: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const { money, d, t } = useI18n();
  const off = pctOff(price, compareAt);
  return (
    <span className={cx("inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums", className)}>
      <span className={cx("font-semibold tracking-tight", size === "lg" ? "text-[26px]" : size === "md" ? "text-[15px]" : "text-[13px]", off ? "text-sale" : "")}>
        {money(price)}
      </span>
      {off ? (
        <>
          <s className={cx("text-muted", size === "lg" ? "text-base" : "text-[13px]")} aria-label={t(d.common.ui.was, { price: money(compareAt!) })}>
            {money(compareAt!)}
          </s>
          {size === "lg" ? (
            <Badge tone="dark">
              <bdi dir="ltr">-{off}%</bdi>
            </Badge>
          ) : null}
        </>
      ) : null}
    </span>
  );
}

/** Five stars as ONE path (one <svg> per row instead of five) — keeps review-heavy pages' HTML small. */
const FIVE_STARS = Array.from({ length: 5 }, (_, i) => {
  const x = i * 24;
  return `M${12 + x} 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L${3.6 + x} 9.6l5.8-.8L${12 + x} 3.5Z`;
}).join("");

function StarRow({ size }: { size: number }) {
  return (
    <svg width={size * 5} height={size} viewBox="0 0 120 24" fill="currentColor" aria-hidden="true" focusable="false" className="shrink-0">
      <path d={FIVE_STARS} />
    </svg>
  );
}

export function Stars({ rating, size = 14, className, tone = "dark" }: { rating: number; size?: number; className?: string; tone?: "dark" | "light" }) {
  const { d, t } = useI18n();
  // stars fill from the reading-start edge (right in Arabic)
  return (
    <span className={cx("relative inline-flex", tone === "light" ? "text-white/25" : "text-ink/15", className)} role="img" aria-label={t(d.common.ui.rated, { rating })}>
      <StarRow size={size} />
      <span className={cx("absolute inset-0 flex overflow-hidden", tone === "light" ? "text-white" : "text-ink")} style={{ width: `${(rating / 5) * 100}%` }}>
        <StarRow size={size} />
      </span>
    </span>
  );
}

export function Badge({ children, tone = "light", className }: { children: ReactNode; tone?: "light" | "dark" | "amber" | "forest" | "sale"; className?: string }) {
  const tones = {
    light: "bg-white/95 text-ink",
    dark: "bg-ink text-white",
    amber: "bg-amber text-ink",
    forest: "bg-forest text-white",
    sale: "bg-sale text-white",
  };
  return <span className={cx("inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-wide", tones[tone], className)}>{children}</span>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[12px] font-semibold uppercase tracking-[0.14em] text-muted", className)}>{children}</p>;
}

export function QtyStepper({ value, onChange, min = 1, max = 10, size = "md", label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; size?: "sm" | "md"; label?: string }) {
  const { d } = useI18n();
  label ??= d.common.ui.quantity;
  const s = size === "sm" ? "size-8" : "size-11";
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label={label}>
      <button type="button" className={cx("tap grid place-items-center rounded-full bg-white shadow-soft transition active:scale-90 disabled:opacity-40", s)} onClick={() => onChange(value - 1)} disabled={value <= min - 1 || value <= 0} aria-label={d.common.ui.decrease}>
        <Icon name={value <= 1 && min === 0 ? "trash" : "minus"} size={size === "sm" ? 14 : 16} />
      </button>
      <output className={cx("min-w-7 text-center font-semibold tabular-nums", size === "sm" ? "text-[13px]" : "text-[15px]")} aria-live="polite">
        {value}
      </output>
      <button type="button" className={cx("tap grid place-items-center rounded-full bg-white shadow-soft transition active:scale-90 disabled:opacity-40", s)} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={d.common.ui.increase}>
        <Icon name="plus" size={size === "sm" ? 14 : 16} />
      </button>
    </div>
  );
}

export function Accordion({ title, children, defaultOpen, icon }: { title: string; children: ReactNode; defaultOpen?: boolean; icon?: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <details className="group border-b border-line" open={defaultOpen}>
      <summary className="tap flex min-h-14 cursor-pointer list-none items-center gap-3 py-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
        {icon ? <Icon name={icon} size={18} className="text-muted" /> : null}
        <span className="flex-1">{title}</span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 transition-colors duration-200 group-open:bg-ink group-open:text-white" aria-hidden>
          <Icon name="plus" size={16} className="transition-transform duration-300 group-open:rotate-45" />
        </span>
      </summary>
      <div className="pb-5 pe-11 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

/** Small "● label" pill (Linea-style section tag). */
export function Pill({ children, dot = "bg-sale", className }: { children: ReactNode; dot?: string; className?: string }) {
  return (
    <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink-2", className)}>
      <span className={cx("size-1.5 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, accent, action, className }: { eyebrow?: string; title: string; accent?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-6 flex items-end justify-between gap-4 md:mb-8", className)}>
      <div>
        {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
        <h2 className="text-h2 text-balance">
          {title} {accent ? <span className="serif-accent text-forest">{accent}</span> : null}
        </h2>
      </div>
      {action}
    </div>
  );
}
