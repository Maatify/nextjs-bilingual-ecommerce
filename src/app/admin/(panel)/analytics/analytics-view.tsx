"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useFirstOpen } from "@/components/fx/page-transition";
import { useState, useTransition } from "react";
import { AreaChart, BarList, CHART_COLORS, Donut, Heatmap, Histogram } from "@/components/admin/charts";
import { AIcon } from "@/components/admin/icons";
import { AnimatedNumber, Badge, Card, PageHeader, Spinner, Stagger, StaggerItem, Stat, Tabs, egp, table, ease } from "@/components/admin/ui";
import { cx } from "@/lib/format";
import type { AnalyticsData, AnalyticsRange } from "@/server/queries/stats";
import { Ltr, useT } from "@/components/admin/i18n";
import { STATUS_TONE } from "@/components/admin/overview/meta";

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "all"];
const PAY_ORDER = ["cod", "card", "wallet", "installments"] as const;
const SRC_ORDER = ["web", "lp", "manual"] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (n: number) => `${n.toFixed(1)}%`;

function Reveal({ children, className, i = 0 }: { children: React.ReactNode; className?: string; i?: number }) {
  const first = useFirstOpen();
  return (
    <motion.div className={className} initial={first && { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45, ease, delay: i * 0.06 }}>
      {children}
    </motion.div>
  );
}

function Mini({ label, value, format = int, hint }: { label: string; value: number; format?: (n: number) => string; hint?: string }) {
  return (
    <div className="rounded-xl border border-a-line bg-a-panel-2/60 p-3.5">
      <p className="text-[12px] text-a-dim">{label}</p>
      <p className="mt-1.5 text-[19px] font-semibold tracking-[-0.02em]">
        <AnimatedNumber value={value} format={format} />
      </p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-a-faint">{hint}</p> : null}
    </div>
  );
}

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, fmt } = useT();
  // Mon..Sun in the admin language (2024-01-01 was a Monday)
  const days = Array.from({ length: 7 }, (_, i) => fmt.weekday(Date.UTC(2024, 0, 1 + i, 12)));
  const payLabel = (k: string) => ((PAY_ORDER as readonly string[]).includes(k) ? t(`overview.analytics.pay.${k as (typeof PAY_ORDER)[number]}`) : k);
  const srcLabel = (k: string) => ((SRC_ORDER as readonly string[]).includes(k) ? t(`overview.analytics.src.${k as (typeof SRC_ORDER)[number]}`) : k);
  const [pending, start] = useTransition();
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [grain, setGrain] = useState<"day" | "week">(data.days.length > 45 ? "week" : "day");
  const series = grain === "day" ? data.days : data.weeks;
  const s = data.summary;

  const payItems = [...data.payments].sort((a, b) => PAY_ORDER.indexOf(a.key as never) - PAY_ORDER.indexOf(b.key as never)).map((p) => ({ key: p.key, label: payLabel(p.key), value: p.orders, color: CHART_COLORS[Math.max(0, PAY_ORDER.indexOf(p.key as never)) % 4], sub: egp(p.revenue) }));
  const srcItems = [...data.sources].sort((a, b) => SRC_ORDER.indexOf(a.key as never) - SRC_ORDER.indexOf(b.key as never)).map((p) => ({ key: p.key, label: srcLabel(p.key), value: p.orders, color: CHART_COLORS[Math.max(0, SRC_ORDER.indexOf(p.key as never)) % 4], sub: t("overview.analytics.aovShort", { value: egp(p.orders ? p.revenue / p.orders : 0) }) }));
  const medianBin = data.histogram.findIndex((b) => data.median >= b.from && data.median < b.to);
  const placed = data.funnel[0]?.value || 1;

  return (
    <div>
      <PageHeader
        title={t("overview.analytics.title")}
        description={t("overview.analytics.description")}
        actions={
          <div className="flex items-center gap-2">
            {pending ? <Spinner size={14} className="text-a-dim" /> : null}
            <Tabs value={data.range} onChange={(r) => start(() => router.push(`${pathname}?range=${r}`, { scroll: false }))} items={RANGES.map((r) => ({ value: r, label: t(`overview.ranges.${r}`) }))} />
          </div>
        }
      />

      <div className={cx("space-y-4 transition-opacity duration-200", pending && "pointer-events-none opacity-60")} aria-busy={pending}>
        <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StaggerItem>
            <Stat label={t("overview.analytics.netRevenue")} value={s.revenue} format={egp} icon="cash" tone="#b4a5ff" />
          </StaggerItem>
          <StaggerItem>
            <Stat label={t("overview.analytics.orders")} value={s.orders} icon="orders" tone="#60a5fa" hint={s.cancelled ? t("overview.analytics.cancelledHint", { count: s.cancelled }) : undefined} />
          </StaggerItem>
          <StaggerItem>
            <Stat label={t("overview.analytics.aov")} value={s.aov} format={egp} icon="receipt" tone="#e879f9" hint={t("overview.analytics.median", { value: egp(data.median) })} />
          </StaggerItem>
          <StaggerItem>
            <Stat label={t("overview.analytics.unitsSold")} value={s.units} icon="products" tone="#2dd4bf" hint={s.orders ? t("overview.analytics.perOrder", { value: (s.units / s.orders).toFixed(2) }) : undefined} />
          </StaggerItem>
        </Stagger>

        <Reveal>
          <Card
            glow
            title={metric === "revenue" ? t("overview.analytics.revenueOverTime") : t("overview.analytics.ordersOverTime")}
            description={grain === "day" ? t("overview.analytics.daily") : t("overview.analytics.weekly")}
            actions={
              <div className="flex flex-wrap justify-end gap-1.5">
                <Tabs size="sm" value={metric} onChange={setMetric} items={[{ value: "revenue", label: t("overview.analytics.revenue") }, { value: "orders", label: t("overview.analytics.orders") }]} />
                <Tabs size="sm" value={grain} onChange={setGrain} items={[{ value: "day", label: t("overview.analytics.day") }, { value: "week", label: t("overview.analytics.week") }]} />
              </div>
            }
          >
            <AreaChart key={`${data.range}-${metric}-${grain}`} data={series} series={[{ key: metric, label: metric === "revenue" ? t("overview.analytics.revenue") : t("overview.analytics.orders"), color: CHART_COLORS[0] }]} format={metric === "revenue" ? egp : int} height={280} ariaLabel={t("overview.analytics.perGrain", { metric: t(`overview.analytics.${metric}`), grain: t(`overview.analytics.${grain}`) })} />
          </Card>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal>
            <Card title={t("overview.analytics.pipeline")} description={t("overview.analytics.pipelineHint")} className="h-full">
              <ol className="space-y-2.5">
                {data.funnel.map((f, i) => {
                  const prev = i ? data.funnel[i - 1].value : f.value;
                  const share = (f.value / placed) * 100;
                  return (
                    <li key={f.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                        <span>{f.label}</span>
                        <span className="tabular-nums">
                          <bdi className="font-medium">{int(f.value)}</bdi>
                          <bdi className="ms-2 text-[12px] text-a-faint">{i ? t("overview.analytics.ofPrevious", { pct: prev ? ((f.value / prev) * 100).toFixed(0) : 0 }) : "100%"}</bdi>
                        </span>
                      </div>
                      <div className="h-6 overflow-hidden rounded-md bg-a-ink/[0.05]">
                        <motion.div className="a-grad h-full origin-left rounded-md rtl:origin-right" style={{ width: `${Math.max(1, share)}%`, opacity: 1 - i * 0.1 }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease, delay: i * 0.08 }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {data.statusCounts.map((c) => (
                  <Badge key={c.status} tone={STATUS_TONE[c.status]} dot>
                    {t(`overview.status.${c.status}`)} <span className="tabular-nums opacity-80">{c.value}</span>
                  </Badge>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal i={1}>
            <Card title={t("overview.analytics.bogo")} description={t("overview.analytics.bogoHint")} className="h-full">
              <div className="grid grid-cols-2 gap-3">
                <Mini label={t("overview.analytics.bogoOrders")} value={data.bogo.orders} hint={t("overview.analytics.bogoShare", { pct: pct(data.bogo.share) })} />
                <Mini label={t("overview.analytics.bogoDiscount")} value={data.bogo.discount} format={egp} hint={t("overview.analytics.freeUnits", { count: data.bogo.freeUnits })} />
                <Mini label={t("overview.analytics.aovWith")} value={data.bogo.aovWith} format={egp} hint={t("overview.analytics.unitsPerOrder", { value: data.bogo.unitsWith.toFixed(1) })} />
                <Mini label={t("overview.analytics.aovWithout")} value={data.bogo.aovWithout} format={egp} />
                {/* multi-buy % (e.g. 2 pieces → 20% off) — shown once it has been used or is part of the period */}
                {data.multi.orders ? (
                  <>
                    <Mini label={t("overview.analytics.multiOrders")} value={data.multi.orders} hint={t("overview.analytics.bogoShare", { pct: pct(data.multi.share) })} />
                    <Mini label={t("overview.analytics.multiDiscount")} value={data.multi.discount} format={egp} hint={t("overview.analytics.totalOfferDiscount", { total: egp(data.bogo.discount + data.multi.discount) })} />
                  </>
                ) : null}
              </div>
              {data.bogo.aovWithout ? (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-a-violet/10 p-3 text-[12.5px] leading-relaxed text-a-dim ring-1 ring-inset ring-a-violet/20">
                  <AIcon name="sparkle" size={15} className="mt-0.5 shrink-0 text-a-accent" />
                  <span>
                    {t(data.bogo.aovWith >= data.bogo.aovWithout ? "overview.analytics.bogoMore" : "overview.analytics.bogoLess", { pct: `${Math.abs((data.bogo.aovWith / data.bogo.aovWithout - 1) * 100).toFixed(0)}%` })}
                  </span>
                </p>
              ) : null}
            </Card>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal>
            <Card title={t("overview.analytics.payments")} description={t("overview.analytics.paymentsHint")} className="h-full">
              {payItems.length ? <Donut items={payItems} centerLabel={t("overview.analytics.orders")} format={int} /> : <p className="py-8 text-center text-[13px] text-a-faint">{t("overview.analytics.noOrders")}</p>}
            </Card>
          </Reveal>
          <Reveal i={1}>
            <Card title={t("overview.analytics.source")} description={t("overview.analytics.sourceHint")} className="h-full">
              {srcItems.length ? <Donut items={srcItems} centerLabel={t("overview.analytics.orders")} format={int} /> : <p className="py-8 text-center text-[13px] text-a-faint">{t("overview.analytics.noOrders")}</p>}
            </Card>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <Reveal>
            <Card title={t("overview.analytics.distribution")} description={t("overview.analytics.distributionHint", { value: egp(data.median) })} className="h-full">
              <div className="pt-6">
                <Histogram
                  bins={data.histogram.map((b) => ({ key: String(b.from), label: b.from >= 1000 ? `${b.from / 1000}k` : String(b.from), title: `${egp(b.from)}–${int(b.to)}`, value: b.value }))}
                  format={(n) => t("overview.analytics.ordersN", { count: Math.round(n) })}
                  highlight={medianBin}
                  height={190}
                />
              </div>
            </Card>
          </Reveal>
          <Reveal i={1}>
            <Card title={t("overview.analytics.when")} description={t("overview.analytics.whenHint")} className="h-full">
              <Heatmap rows={days} cols={HOURS} values={data.heat} format={(n) => t("overview.analytics.ordersN", { count: n })} />
            </Card>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal>
            <Card title={t("overview.analytics.colours")} description={t("overview.analytics.coloursHint")} className="h-full">
              <BarList color={CHART_COLORS[2]} items={data.topColours.map((c) => ({ key: c.name, label: c.name, value: c.units, swatch: c.hex, display: t("overview.analytics.unitsN", { count: c.units }) }))} />
            </Card>
          </Reveal>
          <Reveal i={1}>
            <Card title={t("overview.analytics.sizes")} description={t("overview.analytics.sizesHint")} className="h-full">
              <div className="pt-6">
                <Histogram bins={data.topSizes.map((z) => ({ key: z.name, label: z.name, value: z.units }))} format={(n) => t("overview.analytics.unitsN", { count: Math.round(n) })} color={CHART_COLORS[1]} labelEvery={1} height={190} />
              </div>
            </Card>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Reveal>
            <Card title={t("overview.analytics.repeat")} description={t("overview.analytics.repeatHint")} className="h-full">
              <div className="grid grid-cols-2 gap-3">
                <Mini label={t("overview.analytics.customers")} value={data.cohort.customers} hint={t("overview.analytics.newReturning", { new: data.cohort.newCustomers, returning: data.cohort.returningCustomers })} />
                <Mini label={t("overview.analytics.repeatRate")} value={data.cohort.repeatRate} format={pct} hint={t("overview.analytics.repeatRateHint")} />
                <Mini label={t("overview.analytics.ordersPerCustomer")} value={data.cohort.avgOrders} format={(n) => n.toFixed(2)} />
                <Mini label={t("overview.analytics.revenuePerCustomer")} value={data.cohort.ltv} format={egp} hint={t("overview.analytics.fromRepeat", { pct: pct(data.cohort.repeatRevenueShare) })} />
              </div>
              <BarList className="mt-4" color={CHART_COLORS[3]} items={data.cohort.buckets.map((b) => ({ key: b.label, label: b.label, value: b.value, display: t("overview.analytics.customersN", { count: b.value }) }))} />
            </Card>
          </Reveal>
          <Reveal i={1}>
            <Card title={t("overview.analytics.promo")} description={t("overview.analytics.promoHint", { pct: pct(data.promoOrderShare) })} padded={false} className="h-full">
              {data.codes.length ? (
                <div className={table.wrap}>
                  <table className={cx(table.table, "min-w-[520px]")}>
                    <thead>
                      <tr>
                        <th className={cx(table.th, "text-start")}>{t("overview.analytics.code")}</th>
                        <th className={cx(table.th, "text-end")}>{t("overview.analytics.orders")}</th>
                        <th className={cx(table.th, "text-end")}>{t("overview.analytics.discount")}</th>
                        <th className={cx(table.th, "text-end")}>{t("overview.analytics.revenue")}</th>
                        <th className={cx(table.th, "text-start")}>{t("overview.analytics.limit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.codes.map((c) => (
                        <tr key={c.code} className={table.tr}>
                          <td className={table.td}>
                            <span className="flex items-center gap-2">
                              <span dir="ltr" className="font-mono text-[12.5px] font-medium">{c.code}</span>
                              {!c.active ? <Badge>{t("overview.analytics.inactive")}</Badge> : null}
                            </span>
                            <span className="text-[12px] text-a-faint">{c.label}</span>
                          </td>
                          <td className={cx(table.td, "text-end tabular-nums")}>{int(c.orders)}</td>
                          <td className={cx(table.td, "text-end tabular-nums text-a-dim")}><Ltr>{egp(c.discount)}</Ltr></td>
                          <td className={cx(table.td, "text-end font-medium tabular-nums")}><Ltr>{egp(c.revenue)}</Ltr></td>
                          <td className={table.td}>
                            {c.usageLimit ? (
                              <span className="block w-24">
                                <span dir="ltr" className="text-[12px] tabular-nums text-a-dim">
                                  {c.used}/{c.usageLimit}
                                </span>
                                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-a-ink/[0.07]">
                                  <span className={cx("block h-full rounded-full", c.used / c.usageLimit >= 0.8 ? "bg-a-warn" : "bg-a-violet")} style={{ width: `${Math.min(100, (c.used / c.usageLimit) * 100)}%` }} />
                                </span>
                              </span>
                            ) : (
                              <span className="text-[12px] text-a-faint">{t("overview.analytics.noLimit")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-[13px] text-a-faint">{t("overview.analytics.noCodes")}</p>
              )}
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
