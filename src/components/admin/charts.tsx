"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { useT } from "./i18n";
import { useFirstOpen } from "@/components/fx/page-transition";
import { ease } from "./ui";

/*
 * Admin charts — dependency-free SVG + motion, theme-aware (dark + light) through admin tokens.
 * Categorical order (validated for dark surfaces, CVD-safe adjacent pairs):
 * violet → teal → magenta → amber. Use CHART_COLORS in that fixed order.
 * RTL: time axes stay left→right (dir="ltr" on the plot) — labels/tooltips are translated by the caller
 * and tooltips use the page direction so Arabic text reads correctly.
 */

export const CHART_COLORS = ["#8b74ff", "#0d9488", "#d946ef", "#d97706"] as const;
// theme-aware (dark/light) via admin tokens — CSS vars work in SVG presentation attributes
const GRID = "color-mix(in oklab, var(--color-a-ink) 7%, transparent)";
const AXIS_TEXT = "var(--color-a-faint)";

type Fmt = (n: number) => string;
const defaultFmt: Fmt = (n) => Math.round(n).toLocaleString("en");

/** Track an element's content width (for SVG charts that need real pixels). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round an axis max up to 1/2/2.5/5 × 10^n and return evenly spaced ticks. */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { max: top, ticks };
}

const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(n * 10) / 10}`);

/** Monotone cubic interpolation (no overshoot) through points. */
function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const dy = pts.slice(1).map((p, i) => p[1] - pts[i][1]);
  const s = dx.map((x, i) => (x ? dy[i] / x : 0));
  const m = pts.map((_, i) => (i === 0 ? s[0] : i === n - 1 ? s[n - 2] : s[i - 1] * s[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / s[i - 1] + (dx[i] + 2 * dx[i - 1]) / s[i])));
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + m[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - m[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

/* ───────────────────────── AreaChart ───────────────────────── */

export interface AreaSeries {
  key: string;
  label: string;
  color: string;
  /** dashed comparison line without fill (e.g. previous period) */
  dashed?: boolean;
}

export function AreaChart<T extends { label: string }>({
  data,
  series,
  height = 260,
  format = defaultFmt,
  className,
  ariaLabel,
}: {
  data: T[];
  series: AreaSeries[];
  height?: number;
  format?: Fmt;
  className?: string;
  ariaLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { t, dir } = useT();
  ariaLabel ??= t("overview.charts.chart");
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const val = (d: T, k: string) => Number((d as Record<string, unknown>)[k]) || 0;

  const m = { t: 12, r: 12, b: 26, l: 48 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const { max, ticks } = niceTicks(Math.max(0, ...data.flatMap((d) => series.map((s) => val(d, s.key)))));
  const x = (i: number) => m.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / max) * ih;

  const paths = useMemo(
    () =>
      series.map((s) => {
        const pts = data.map((d, i) => [x(i), y(val(d, s.key))] as [number, number]);
        const line = monotonePath(pts);
        const area = pts.length ? `${line} L${x(data.length - 1)},${m.t + ih} L${x(0)},${m.t + ih} Z` : "";
        return { ...s, line, area };
      }),
    // x/y/m/ih are recreated every render but derive only from these inputs, so listing them would recompute every time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, series, width, height, max],
  );

  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 72))));
  const sig = `${data.length}-${data[0]?.label}-${series.map((s) => s.key).join()}-${max}`;
  // draw-in on the page's first open, and again whenever the data set changes (range switch / new orders)
  const [sig0] = useState(sig);
  const draw = useFirstOpen() || sig !== sig0;
  const pick = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - m.l;
    const i = data.length <= 1 ? 0 : Math.round((px / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? x(hover) : 0;
  const flip = tipLeft > width * 0.62;

  return (
    <div ref={ref} dir="ltr" className={cx("relative w-full select-none", className)} style={{ height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block touch-pan-y"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              setHover((i) => Math.max(0, Math.min(data.length - 1, (i ?? (e.key === "ArrowRight" ? -1 : data.length)) + (e.key === "ArrowRight" ? 1 : -1))));
            }
            if (e.key === "Escape") setHover(null);
          }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.32" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <clipPath id={`${gid}-clip`}>
              <motion.rect key={sig} x={m.l} y={0} height={height} initial={draw && { width: 0 }} animate={{ width: iw + m.r }} transition={{ duration: 1, ease }} />
            </clipPath>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={m.l - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT} className="tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              (i === data.length - 1 && i % labelEvery !== 0 && (data.length - 1) % labelEvery < labelEvery / 2) ? null : (
                <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="11" fill={AXIS_TEXT}>
                  {d.label}
                </text>
              )
            ) : null,
          )}

          <g clipPath={`url(#${gid}-clip)`}>
            {paths.map((p) => (p.dashed ? null : <path key={`a-${p.key}`} d={p.area} fill={`url(#${gid}-${p.key})`} />))}
            {paths.map((p) => (p.dashed ? <path key={`l-${p.key}`} d={p.line} fill="none" stroke={p.color} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" /> : null))}
          </g>
          {paths.map((p) =>
            p.dashed ? null : (
              <motion.path key={`l-${p.key}-${sig}`} d={p.line} fill="none" stroke={p.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={draw && { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease }} />
            ),
          )}

          {h && hover !== null ? (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="color-mix(in oklab, var(--color-a-ink) 24%, transparent)" strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(val(h, s.key))} r={4.5} fill={s.dashed ? "var(--color-a-panel)" : s.color} stroke={s.dashed ? s.color : "var(--color-a-panel)"} strokeWidth={2} />
              ))}
            </g>
          ) : null}
          {/* invisible hit area */}
          <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" />
        </svg>
      ) : null}

      <AnimatePresence>
        {h && hover !== null ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            dir={dir}
            className="pointer-events-none absolute top-1 z-10 min-w-[150px] max-w-[calc(100%-1rem)] rounded-xl border border-a-line-strong bg-a-panel-2/95 px-3 py-2.5 shadow-[0_16px_40px_-16px_var(--a-shadow)] backdrop-blur"
            style={flip ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}
          >
            <p className="mb-1.5 text-[11.5px] font-medium text-a-dim">{h.label}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-4 text-[12.5px]">
                <span className="flex items-center gap-1.5 text-a-dim">
                  <span className={cx("h-[3px] w-3 rounded-full", s.dashed && "opacity-60")} style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-medium tabular-nums text-a-text">{format(val(h, s.key))}</span>
              </p>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>{t("overview.charts.period")}</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{d.label}</td>
              {series.map((s) => (
                <td key={s.key}>{format(val(d, s.key))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small legend row for multi-series charts. */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-a-dim">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <svg width="14" height="4" aria-hidden>
            <line x1="1" x2="13" y1="2" y2="2" stroke={it.color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={it.dashed ? "3 3" : undefined} strokeOpacity={it.dashed ? 0.7 : 1} />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ───────────────────────── BarList ───────────────────────── */

export interface BarItem {
  key: string;
  label: React.ReactNode;
  value: number;
  /** text shown on the right instead of the formatted value */
  display?: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  image?: string;
  /** colour swatch dot before the label */
  swatch?: string;
  color?: string;
}

export function BarList({ items, format = defaultFmt, color = CHART_COLORS[0], max: maxProp, empty, className }: { items: BarItem[]; format?: Fmt; color?: string; max?: number; empty?: string; className?: string }) {
  const first = useFirstOpen(); // load-in only on the page's first open
  const { t } = useT();
  empty ??= t("overview.charts.noData");
  const max = maxProp ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-8 text-center text-[13px] text-a-faint">{empty}</p>;
  return (
    <ul className={cx("space-y-1", className)}>
      {items.map((it, idx) => {
        const body = (
          <>
            {it.image ? (
              <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-[#f1f1ee]">
                <Image src={it.image} alt="" fill sizes="36px" className="object-cover" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 truncate text-[13px] text-a-text">
                  {it.swatch ? <span className="size-2.5 shrink-0 rounded-full ring-1 ring-a-ink/15" style={{ background: it.swatch }} /> : null}
                  <span className="truncate">{it.label}</span>
                </span>
                <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-a-text">{it.display ?? format(it.value)}</span>
              </span>
              {it.sub ? <span className="mt-0.5 block truncate text-[11.5px] text-a-faint">{it.sub}</span> : null}
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-a-ink/[0.06]">
                <motion.span
                  className="block h-full origin-left rounded-full rtl:origin-right"
                  style={{ background: it.color ?? color, width: `${Math.max(1.5, (it.value / max) * 100)}%` }}
                  initial={first && { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease, delay: 0.05 + idx * 0.04 }}
                />
              </span>
            </span>
          </>
        );
        const cls = "flex items-center gap-3 rounded-xl px-2 py-2 -mx-2";
        return (
          <li key={it.key}>
            {it.href ? (
              <Link href={it.href} className={cx(cls, "transition-colors hover:bg-a-ink/[0.035]")}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────── Donut ───────────────────────── */

export interface DonutItem {
  key: string;
  label: string;
  value: number;
  color: string;
  sub?: string;
}

function arc(cx0: number, cy0: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx0 + r * Math.cos(a - Math.PI / 2), cy0 + r * Math.sin(a - Math.PI / 2)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

export function Donut({ items, format = defaultFmt, centerLabel, size = 168, className }: { items: DonutItem[]; format?: Fmt; centerLabel?: string; size?: number; className?: string }) {
  const first = useFirstOpen(); // load-in only on the page's first open
  const { t } = useT();
  centerLabel ??= t("overview.charts.total");
  const [active, setActive] = useState<string | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  const stroke = 16;
  const r = (size - stroke) / 2 - 2;
  const gap = items.filter((i) => i.value > 0).length > 1 ? 0.035 : 0;
  const nonZero = items.filter((i) => i.value > 0);
  const ends = nonZero.map((_, i) => nonZero.slice(0, i + 1).reduce((s, x) => s + x.value, 0));
  const segs = nonZero
    .map((it, i) => {
      const a0 = ((ends[i] - it.value) / total) * Math.PI * 2;
      const a1 = (ends[i] / total) * Math.PI * 2;
      return { ...it, d: arc(size / 2, size / 2, r, a0 + gap / 2, Math.max(a0 + gap / 2 + 0.001, a1 - gap / 2)) };
    });
  const cur = items.find((i) => i.key === active);
  return (
    <div className={cx("flex flex-col items-center gap-5 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel}: ${items.map((i) => `${i.label} ${format(i.value)}`).join(", ")}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab, var(--color-a-ink) 6%, transparent)" strokeWidth={stroke} />
          {segs.map((s, i) => (
            <motion.path
              key={`${s.key}-${total}`}
              d={s.d}
              fill="none"
              stroke={s.color}
              strokeWidth={active === s.key ? stroke + 4 : stroke}
              strokeLinecap="butt"
              initial={first && { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: active && active !== s.key ? 0.35 : 1 }}
              transition={{ pathLength: { duration: 0.7, ease, delay: 0.1 + i * 0.12 }, opacity: { duration: 0.15 } }}
              onPointerEnter={() => setActive(s.key)}
              onPointerLeave={() => setActive(null)}
              style={{ cursor: "pointer", transition: "stroke-width 150ms" }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11.5px] text-a-dim">{cur ? cur.label : centerLabel}</p>
            <p className="text-[19px] font-semibold tabular-nums tracking-[-0.02em]">{format(cur ? cur.value : total)}</p>
            {cur && total ? <p className="text-[11.5px] tabular-nums text-a-faint">{((cur.value / total) * 100).toFixed(1)}%</p> : null}
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              onPointerEnter={() => setActive(it.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(it.key)}
              onBlur={() => setActive(null)}
              className={cx("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-[13px] transition-colors", active === it.key ? "bg-a-ink/[0.05]" : "hover:bg-a-ink/[0.03]")}
            >
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
              <span className="min-w-0 flex-1 truncate text-a-text">
                {it.label}
                {it.sub ? <span className="ms-1.5 text-a-faint">{it.sub}</span> : null}
              </span>
              <span dir="ltr" className="tabular-nums text-a-dim">{total ? `${((it.value / total) * 100).toFixed(0)}%` : "—"}</span>
              <span dir="ltr" className="w-[72px] shrink-0 text-end font-medium tabular-nums">{format(it.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────── Heatmap ───────────────────────── */

export function Heatmap({ rows, cols, values, format, colLabelEvery = 3, className }: { rows: string[]; cols: string[]; values: number[][]; format?: Fmt; colLabelEvery?: number; className?: string }) {
  const first = useFirstOpen(); // load-in only on the page's first open
  const { t, dir } = useT();
  const fmtCell: Fmt = format ?? ((n) => t("overview.analytics.ordersN", { count: n }));
  const max = Math.max(1, ...values.flat());
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const peak = useMemo(() => {
    let best = { r: 0, c: 0, v: -1 };
    values.forEach((row, r) => row.forEach((v, c) => v > best.v && (best = { r, c, v })));
    return best;
  }, [values]);
  const shown = hover ?? { r: peak.r, c: peak.c };
  return (
    <div className={className}>
      <p className="mb-3 h-5 text-[12.5px] text-a-dim" aria-live="polite">
        <span className="text-a-text">
          {rows[shown.r]} <bdi dir="ltr">{cols[shown.c]}</bdi>
        </span>{" "}
        · {fmtCell(values[shown.r]?.[shown.c] ?? 0)}
        {!hover ? <span className="text-a-faint"> — {t("overview.charts.busiest")}</span> : null}
      </p>
      <div className="a-scroll overflow-x-auto pb-1" dir="ltr">
        <div className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: `${dir === "rtl" ? 52 : 36}px repeat(${cols.length}, minmax(0, 1fr))` }} onPointerLeave={() => setHover(null)}>
          {values.map((row, r) => (
            <div key={r} className="contents">
              <span className="self-center text-[11px] text-a-faint">{rows[r]}</span>
              {row.map((v, c) => {
                const t = v / max;
                return (
                  <motion.button
                    type="button"
                    key={c}
                    aria-label={`${rows[r]} ${cols[c]}: ${fmtCell(v)}`}
                    onPointerEnter={() => setHover({ r, c })}
                    onFocus={() => setHover({ r, c })}
                    initial={first && { opacity: 0, scale: 0.6 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, ease, delay: (c + r) * 0.012 }}
                    className={cx("aspect-square rounded-[4px] outline-offset-1 transition-shadow", hover?.r === r && hover?.c === c && "ring-2 ring-a-ink/70")}
                    style={{ background: v ? `rgb(139 116 255 / ${(0.12 + t * 0.88).toFixed(3)})` : "color-mix(in oklab, var(--color-a-ink) 5%, transparent)" }}
                  />
                );
              })}
            </div>
          ))}
          <span />
          {cols.map((c, i) => (
            <span key={c} className="pt-1 text-center text-[10.5px] text-a-faint">
              {i % colLabelEvery === 0 ? c : ""}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-a-faint">
        {t("overview.charts.less")}
        {[0.12, 0.34, 0.56, 0.78, 1].map((o) => (
          <span key={o} className="size-3 rounded-[3px]" style={{ background: `rgb(139 116 255 / ${o})` }} />
        ))}
        {t("overview.charts.more")}
      </div>
    </div>
  );
}

/* ───────────────────────── Histogram / vertical bars ───────────────────────── */

export interface HistBin {
  key: string;
  label: string;
  value: number;
  /** tooltip title (defaults to label) */
  title?: string;
}

export function Histogram({ bins, format = defaultFmt, height = 180, color = CHART_COLORS[0], highlight, highlightColor = CHART_COLORS[2], labelEvery, className }: { bins: HistBin[]; format?: Fmt; height?: number; color?: string; highlight?: number; highlightColor?: string; labelEvery?: number; className?: string }) {
  const first = useFirstOpen(); // load-in only on the page's first open
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bins.map((b) => b.value));
  const every = labelEvery ?? Math.max(1, Math.ceil(bins.length / 8));
  const { dir } = useT();
  // keep the tooltip inside the chart near the edges
  const at = hover === null ? 0 : (hover + 0.5) / bins.length;
  const shift = at < 0.18 ? "translate-x-[-12px]" : at > 0.82 ? "-translate-x-[calc(100%-12px)]" : "-translate-x-1/2";
  return (
    <div dir="ltr" className={cx("relative", className)}>
      <div className="relative flex items-end gap-[3px] border-b border-a-ink/[0.08]" style={{ height }} onPointerLeave={() => setHover(null)}>
        {bins.map((b, i) => (
          <button
            type="button"
            key={b.key}
            aria-label={`${b.title ?? b.label}: ${format(b.value)}`}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group relative flex h-full min-w-0 flex-1 items-end outline-offset-2"
          >
            <motion.span
              className="block w-full origin-bottom rounded-t-[4px] transition-opacity"
              style={{ height: `${Math.max(b.value ? 2 : 0, (b.value / max) * 100)}%`, background: i === highlight ? highlightColor : color, opacity: hover === null || hover === i ? 1 : 0.45 }}
              initial={first && { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease, delay: i * 0.025 }}
            />
          </button>
        ))}
        <AnimatePresence>
          {hover !== null ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              dir={dir}
              className={cx("pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg", shift, " border border-a-line-strong bg-a-panel-2/95 px-2.5 py-1.5 text-[12px] shadow-lg backdrop-blur")}
              style={{ left: `${at * 100}%` }}
            >
              <span className="text-a-dim">{bins[hover].title ?? bins[hover].label}</span> <span className="font-medium tabular-nums">{format(bins[hover].value)}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {bins.map((b, i) => (
          <span key={b.key} className="min-w-0 flex-1 truncate text-center text-[10.5px] text-a-faint">
            {i % every === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
