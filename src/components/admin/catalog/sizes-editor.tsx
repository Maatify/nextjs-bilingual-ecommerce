"use client";

import { cx } from "@/lib/format";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { LOW_STOCK } from "./shared";
/** Stock stepper used by the editor and the inventory matrix. */
export function Stepper({ value, onChange, label, compact }: { value: number; onChange: (n: number) => void; label: string; compact?: boolean }) {
  const { t } = useT();
  const tone = value <= 0 ? "text-a-danger" : value <= LOW_STOCK ? "text-a-warn" : "text-a-text";
  return (
    <div className={cx("inline-flex items-center rounded-[10px] border border-a-line bg-a-panel-2 transition has-[input:focus]:border-a-violet/70 has-[input:focus]:ring-[3px] has-[input:focus]:ring-a-violet/20", compact ? "h-8" : "h-9")}>
      <button type="button" aria-label={t("products.stepper.decrease", { label })} onClick={() => onChange(Math.max(0, value - 1))} className={cx("grid h-full place-items-center rounded-s-[9px] text-a-dim transition hover:bg-a-hover hover:text-a-text active:scale-90", compact ? "w-7" : "w-8")}>
        <AIcon name="minus" size={13} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={label}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        onFocus={(e) => e.target.select()}
        className={cx("h-full bg-transparent text-center text-[13px] font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", compact ? "w-10" : "w-12", tone)}
      />
      <button type="button" aria-label={t("products.stepper.increase", { label })} onClick={() => onChange(value + 1)} className={cx("grid h-full place-items-center rounded-e-[9px] text-a-dim transition hover:bg-a-hover hover:text-a-text active:scale-90", compact ? "w-7" : "w-8")}>
        <AIcon name="plus" size={13} />
      </button>
    </div>
  );
}
