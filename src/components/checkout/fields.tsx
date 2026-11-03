"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";

const control =
  "h-[52px] w-full rounded-2xl bg-surface px-4 text-[16px] ring-1 ring-ink/15 outline-none transition-[box-shadow] placeholder:text-muted/70 hover:ring-ink/30 focus:ring-2 focus:ring-ink aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-sale";

function Shell({ id, label, optional, error, hint, children, className }: { id: string; label: string; optional?: boolean; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const { d } = useI18n();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-[14px] font-medium text-ink">
        {label}
        {optional ? <span className="text-[13px] font-normal text-muted">{d.checkout.optional}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-sale" role="alert">
          <Icon name="info" size={14} /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Field({ id, label, optional, error, hint, prefix, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; optional?: boolean; error?: string; hint?: ReactNode; prefix?: ReactNode }) {
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  // LTR inputs (phone, email, card) keep their prefix chip on the physical left, even on Arabic pages
  const ltrInput = rest.dir === "ltr";
  return (
    <Shell id={id} label={label} optional={optional} error={error} hint={hint} className={className}>
      <div className="relative">
        {prefix ? (
          <span dir="ltr" className={cx("pointer-events-none absolute inset-y-0 my-1.5 flex items-center rounded-xl bg-surface-2 px-3 text-[14px] font-semibold text-ink-2", ltrInput ? "left-1.5" : "inset-s-1.5")}>
            {prefix}
          </span>
        ) : null}
        <input id={id} name={id} aria-invalid={!!error} aria-describedby={describedBy} aria-required={!optional} className={cx(control, prefix && "ps-[76px]", ltrInput && "text-left placeholder:text-left")} {...rest} />
      </div>
    </Shell>
  );
}

export function SelectField({ id, label, error, hint, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; error?: string; hint?: ReactNode }) {
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <div className="relative">
        <select id={id} name={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={cx(control, "cursor-pointer appearance-none pe-10")} {...rest}>
          {children}
        </select>
        <Icon name="chevronDown" size={18} className="pointer-events-none absolute inset-e-4 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </Shell>
  );
}

/** Radio rendered as a selectable card; the native input keeps keyboard + SR semantics. */
export function RadioCard({ name, value, checked, onChange, title, description, aside, badge, children }: { name: string; value: string; checked: boolean; onChange: (v: string) => void; title: ReactNode; description?: ReactNode; aside?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx("rounded-2xl bg-surface ring-1 transition-[box-shadow,background-color]", checked ? "ring-2 ring-ink" : "ring-ink/15 hover:ring-ink/30")}>
      <label className="tap flex cursor-pointer items-start gap-3.5 p-4">
        <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="peer sr-only" />
        <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 transition peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2", checked ? "bg-ink ring-ink" : "bg-surface ring-ink/25")} aria-hidden>
          <span className={cx("size-2 rounded-full bg-white transition-transform duration-200", checked ? "scale-100" : "scale-0")} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            {title}
            {badge}
          </span>
          {description ? <span className="mt-0.5 block text-[14px] text-muted">{description}</span> : null}
        </span>
        {aside ? <span className="shrink-0 text-end text-[14px] font-semibold tabular-nums">{aside}</span> : null}
      </label>
      {checked && children ? <div className="border-t border-line px-4 pb-4 pt-4">{children}</div> : null}
    </div>
  );
}

export function CheckboxCard({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cx("tap flex cursor-pointer items-start gap-3.5 rounded-2xl p-4 ring-1 transition", checked ? "bg-surface ring-2 ring-ink" : "bg-surface ring-ink/15 hover:ring-ink/30", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1 transition peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2", checked ? "bg-ink text-white ring-ink" : "bg-surface ring-ink/25")} aria-hidden>
        <Icon name="check" size={14} strokeWidth={2.4} className={cx("transition-transform duration-200", checked ? "scale-100" : "scale-0")} />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export function SectionTitle({ step, children, aside }: { step?: number; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-h3">
        {step ? <span className="font-poster text-[15px] text-muted tabular-nums" aria-hidden>{String(step).padStart(2, "0")}</span> : null}
        {children}
      </h2>
      {aside}
    </div>
  );
}
