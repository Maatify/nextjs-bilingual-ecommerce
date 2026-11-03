"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { cx } from "@/lib/format";
import { CHARTS, recommend, type Body, type FitPref } from "@/lib/size";
import type { Product } from "@/lib/types";

type Tab = "finder" | "chart";
const KEY = "verda:fit";

interface Inputs {
  height: number;
  weight: number;
  body: Body;
  pref: FitPref;
}

function loadInputs(gender: Product["gender"]): Inputs {
  const fallback: Inputs = gender === "women" ? { height: 165, weight: 60, body: "women", pref: "regular" } : { height: 178, weight: 75, body: "men", pref: "regular" };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && typeof saved.height === "number") return { ...fallback, ...saved, body: gender === "unisex" ? saved.body : fallback.body };
  } catch {}
  return fallback;
}

/**
 * Height/weight size recommender + size chart in one sheet.
 * Props-driven so it can be reused on ad landing pages.
 */
export function FindMySize({
  product: p,
  open,
  initialTab = "finder",
  onClose,
  onSelect,
}: {
  product: Product;
  open: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onSelect: (size: string) => void;
}) {
  const { d } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={d.product.finder.title} side="responsive" width="max-w-[520px]">
      {open ? <FinderBody key={initialTab} product={p} initialTab={initialTab} onSelect={onSelect} /> : null}
    </Sheet>
  );
}

function FinderBody({ product: base, initialTab, onSelect }: { product: Product; initialTab: Tab; onSelect: (size: string) => void }) {
  const { d, t, product, isAr } = useI18n();
  const T = d.product.finder;
  const p = product(base);
  const [tab, setTab] = useState<Tab>(initialTab);
  // lazy init reads localStorage once — this body only mounts client-side when the sheet opens
  const [inputs, setInputs] = useState<Inputs>(() => loadInputs(p.gender));
  const [done, setDone] = useState(false);
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const chart = p.sizeChart === "onesize" ? null : CHARTS[p.sizeChart];

  const result = useMemo(
    () =>
      chart
        ? recommend({ ...inputs, chart: p.sizeChart as Exclude<Product["sizeChart"], "onesize">, fit: p.fit, labels: p.sizes.map((s) => s.label) })
        : null,
    [inputs, chart, p],
  );

  const update = (patch: Partial<Inputs>) => {
    setDone(false);
    setInputs((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  if (!chart) return null;
  const stockOf = (label: string) => p.sizes.find((s) => s.label === label)?.stock ?? 0;
  const conv = (v: string | number) =>
    unit === "cm"
      ? v
      : String(v)
          .split("–")
          .map((n) => (Number(n) / 2.54).toFixed(1))
          .join("–");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label={T.tabs}>
        {(["finder", "chart"] as Tab[]).map((tb) => (
          <button
            key={tb}
            role="tab"
            aria-selected={tab === tb}
            onClick={() => setTab(tb)}
            className={cx("tap h-10 rounded-full text-[14px] font-semibold transition", tab === tb ? "bg-white shadow-soft" : "text-muted hover:text-ink")}
          >
            {tb === "finder" ? T.tabFinder : T.tabChart}
          </button>
        ))}
      </div>

      {tab === "finder" ? (
        <div className="space-y-5" role="tabpanel">
          <p className="text-[14px] text-ink-2">{T.intro}</p>

          {p.gender === "unisex" ? (
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">{T.shopAs}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["women", "men"] as Body[]).map((b) => (
                  <Choice key={b} on={inputs.body === b} onClick={() => update({ body: b })}>
                    {b === "women" ? T.women : T.men}
                  </Choice>
                ))}
              </div>
            </fieldset>
          ) : null}

          <Slider id="fit-height" label={T.height} unit={T.cm} aria={t(T.inUnit, { label: T.height, unit: T.cm })} rtl={isAr} min={145} max={205} value={inputs.height} onChange={(height) => update({ height })} />
          <Slider id="fit-weight" label={T.weight} unit={T.kg} aria={t(T.inUnit, { label: T.weight, unit: T.kg })} rtl={isAr} min={40} max={140} value={inputs.weight} onChange={(weight) => update({ weight })} />

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">{T.fitPref}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["slim", "regular", "relaxed"] as FitPref[]).map((f) => (
                <Choice key={f} on={inputs.pref === f} onClick={() => update({ pref: f })}>
                  <span>{T.prefs[f]}</span>
                </Choice>
              ))}
            </div>
          </fieldset>

          {!done ? (
            <Button className="w-full" size="lg" onClick={() => setDone(true)}>
              <Icon name="sparkle" size={18} /> {T.getSize}
            </Button>
          ) : result ? (
            <div className="rounded-[22px] bg-forest p-5 text-white" role="status" aria-live="polite">
              <div className="flex items-center gap-4">
                <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white text-[24px] font-semibold text-forest">{result.size}</span>
                <div>
                  <p className="text-[13px] text-white/70">{T.recommend}</p>
                  <p className="text-[20px] font-semibold leading-tight">{t(T.sizeX, { size: result.size })}</p>
                  <p className="mt-1 text-[13px] text-white/80">{p.fit === "true" ? T.basedOn : p.fit === "large" ? T.basedOnRoomy : T.basedOnSnug}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[12px] text-white/70">
                  <span>{T.confidence}</span>
                  <bdi dir="ltr" className="tabular-nums">
                    {result.confidence}%
                  </bdi>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${result.confidence}%` }} />
                </div>
              </div>
              {result.alt ? (
                <p className="mt-3 text-[13px] text-white/80">
                  {t(chart.rows.findIndex((r) => r[0] === result.alt) > chart.rows.findIndex((r) => r[0] === result.size) ? T.betweenRoomier : T.betweenCloser, { alt: result.alt })}
                </p>
              ) : null}
              {p.fit !== "true" ? <p className="mt-2 text-[12px] text-white/70">{p.fit === "small" ? T.adjustedSmall : T.adjustedLarge}</p> : null}
              {stockOf(result.size) === 0 ? (
                <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[13px]">{t(T.soldOutResult, { size: result.size })}</p>
              ) : null}
              <button
                onClick={() => onSelect(result.size)}
                data-autofocus
                className="tap mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-ink transition hover:bg-cream active:scale-[0.98]"
              >
                <Icon name="check" size={18} /> {t(T.select, { size: result.size })}
              </button>
              <p className="mt-3 text-center text-[12px] text-white/60">{T.exchange}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5" role="tabpanel">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted">{T.body}</p>
            <div className="flex rounded-full bg-surface-2 p-0.5 text-[12px] font-semibold" role="group" aria-label={T.units}>
              {(["cm", "in"] as const).map((u) => (
                <button key={u} onClick={() => setUnit(u)} aria-pressed={unit === u} className={cx("tap h-8 rounded-full px-3 transition", unit === u ? "bg-ink text-white" : "text-muted")}>
                  {u === "cm" ? T.cm : T.in}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
            <table className="w-full min-w-[420px] text-start text-[13px] tabular-nums">
              <thead>
                <tr className="border-b border-line text-muted">
                  {chart.head.map((h) => (
                    <th key={h} scope="col" className="py-2.5 pe-3 font-semibold">
                      {d.product.chart[h as keyof typeof d.product.chart] ?? h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((r) => (
                  <tr key={String(r[0])} className={cx("border-b border-line", result && done && r[0] === result.size && "bg-sage-soft")}>
                    {r.map((c, i) =>
                      i === 0 ? (
                        <th key={i} scope="row" className="py-2.5 pe-3 font-semibold">
                          {c}
                        </th>
                      ) : (
                        <td key={i} className="py-2.5 pe-3">
                          <bdi dir="ltr">{conv(c)}</bdi>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-2xl bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
            <p className="mb-2 flex items-center gap-2 font-semibold text-ink">
              <Icon name="ruler" size={16} /> {T.measure}
            </p>
            <ul className="space-y-1.5">
              {p.sizeChart === "bottoms" ? (
                <>
                  <li><b>{T.waistLabel}</b> {T.waistBottoms}</li>
                  <li><b>{T.hipLabel}</b> {T.hip}</li>
                  <li><b>{T.inseamLabel}</b> {T.inseam}</li>
                </>
              ) : (
                <>
                  <li><b>{T.chestLabel}</b> {T.chest}</li>
                  <li><b>{T.waistLabel}</b> {T.waistTops}</li>
                  <li><b>{T.lengthLabel}</b> {T.length}</li>
                </>
              )}
            </ul>
          </div>
          {p.modelInfo ? <p className="text-[13px] text-muted">{p.modelInfo.replace(/[.。]\s*$/, "")}.</p> : null}
        </div>
      )}
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx("tap h-11 rounded-full border text-[14px] font-semibold transition active:scale-[0.97]", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40")}
    >
      {children}
    </button>
  );
}

/** In RTL the range input runs right→left, so the filled track grows from the right too. */
function Slider({ id, label, unit, aria, rtl, min, max, value, onChange }: { id: string; label: string; unit: string; aria: string; rtl: boolean; min: number; max: number; value: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold">
          {label}
        </label>
        <span className="flex items-center gap-1 rounded-full bg-surface-2 py-1 ps-3 pe-3">
          <input
            type="number"
            inputMode="numeric"
            aria-label={aria}
            min={min}
            max={max}
            value={value}
            onChange={(e) => e.target.value && onChange(clamp(Number(e.target.value)))}
            className="w-11 bg-transparent text-end text-[15px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[13px] text-muted">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-forest"
        style={{ background: `linear-gradient(to ${rtl ? "left" : "right"}, var(--color-forest) ${((value - min) / (max - min)) * 100}%, var(--color-surface-2) 0)` }}
      />
    </div>
  );
}
