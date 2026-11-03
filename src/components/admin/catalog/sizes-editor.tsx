"use client";

import { AnimatePresence, motion } from "motion/react";
import { cx } from "@/lib/format";
import type { SizeStock } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Button, IconBtn, Input, ease } from "../ui";
import { useStableKeys } from "./keys";
import { LOW_STOCK } from "./shared";

const PRESETS: { label: string; sizes: string[] }[] = [
  { label: "XS–XXL", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "S–XL", sizes: ["S", "M", "L", "XL"] },
  { label: "Waist 28–36", sizes: ["28", "30", "32", "34", "36"] },
  { label: "One size", sizes: ["One size"] },
];

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

export function SizesEditor({ sizes, onChange, error }: { sizes: SizeStock[]; onChange: (s: SizeStock[]) => void; error?: string | null }) {
  const { t } = useT();
  const k = useStableKeys(sizes.length);
  const total = sizes.reduce((n, s) => n + (s.stock || 0), 0);

  const applyPreset = (labels: string[]) => {
    const prev = new Map(sizes.map((s) => [s.label.toUpperCase(), s.stock]));
    k.reset(labels.length);
    onChange(labels.map((label) => ({ label, stock: prev.get(label.toUpperCase()) ?? 0 })));
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="me-1 text-[12px] text-a-faint">{t("products.sizes.quickPresets")}</span>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => applyPreset(p.sizes)} className="h-7 rounded-full bg-a-ink/[0.04] px-2.5 text-[12px] text-a-dim ring-1 ring-a-line transition hover:text-a-text hover:ring-a-line-strong active:scale-95">
            {p.label}
          </button>
        ))}
      </div>
      {error ? <p className="mb-3 rounded-lg bg-a-danger/10 px-3 py-2 text-[12.5px] text-a-danger">{error}</p> : null}
      <div className="rounded-xl border border-a-line">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_36px] items-center gap-3 border-b border-a-line px-3 py-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint">
          <span>{t("products.sizes.size")}</span>
          <span>{t("products.sizes.stock")}</span>
          <span />
        </div>
        <AnimatePresence initial={false}>
          {sizes.map((s, i) => (
            <motion.div key={k.keys[i]} layout="position" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden border-b border-a-line/70 last:border-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_36px] items-center gap-3 px-3 py-2">
                <Input aria-label={t("products.sizes.labelAria", { n: i + 1 })} value={s.label} onChange={(e) => onChange(sizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="max-w-[160px]" />
                <Stepper label={t("products.sizes.stockFor", { size: s.label || t("products.sizes.sizeN", { n: i + 1 }) })} value={s.stock} onChange={(n) => onChange(sizes.map((x, j) => (j === i ? { ...x, stock: n } : x)))} />
                <IconBtn
                  icon="close"
                  label={t("products.sizes.remove", { size: s.label })}
                  disabled={sizes.length <= 1}
                  onClick={() => {
                    k.remove(i);
                    onChange(sizes.filter((_, j) => j !== i));
                  }}
                  className="disabled:opacity-30"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          icon="plus"
          onClick={() => {
            k.add();
            onChange([...sizes, { label: "", stock: 0 }]);
          }}
        >
          {t("products.sizes.add")}
        </Button>
        <span className="text-[12.5px] text-a-dim">
          {t("products.variants.total")} <span className="font-medium tabular-nums text-a-text">{total.toLocaleString("en")}</span> {t("products.variants.units")}
        </span>
      </div>
    </div>
  );
}
