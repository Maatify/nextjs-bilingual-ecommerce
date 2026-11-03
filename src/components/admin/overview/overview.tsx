"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useFirstOpen } from "@/components/fx/page-transition";
import { useState, useTransition } from "react";
import { AreaChart, BarList, CHART_COLORS, Legend } from "@/components/admin/charts";
import { AIcon, type AIconName } from "@/components/admin/icons";
import { Ltr, useT } from "@/components/admin/i18n";
import { Badge, Card, EmptyState, PageHeader, Spinner, Stagger, StaggerItem, Stat, Tabs, egp, table, ease } from "@/components/admin/ui";
import { cx } from "@/lib/format";
import type { OverviewData, RangeKey } from "@/server/queries/stats";
import { activityDetail, activityLabel, actorLabel } from "./activity-i18n";
import { STATUS_TONE, activityMeta } from "./meta";

const RANGES: RangeKey[] = ["today", "7d", "30d", "90d"];

const pct = (n: number) => `${n.toFixed(1)}%`;
const KPI_META: Record<string, { icon: AIconName; format: (n: number) => string; tone: string }> = {
  revenue: { icon: "cash", format: egp, tone: "#b4a5ff" },
  orders: { icon: "orders", format: (n) => Math.round(n).toLocaleString("en"), tone: "#60a5fa" },
  aov: { icon: "receipt", format: egp, tone: "#e879f9" },
  ipo: { icon: "layers", format: (n) => n.toFixed(2), tone: "#2dd4bf" },
  returningRate: { icon: "customers", format: pct, tone: "#4ade80" },
  codShare: { icon: "truck", format: pct, tone: "#fb923c" },
};

export function Overview({ data, greeting, dateLabel, top, bottom }: { data: OverviewData; greeting: string; dateLabel: string; top?: React.ReactNode; bottom?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, fmt: f, isRtl } = useT();
  const first = useFirstOpen(); // load-in staggers play on the page's first open only
  const [pending, start] = useTransition();
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const h = data.health;
  const healthy = h.pending === 0 && h.lowStock === 0;

  const setRange = (r: RangeKey) => start(() => router.push(`${pathname}?range=${r}`, { scroll: false }));

  const total = data.kpis.find((k) => k.key === metric)!;
  const fmt = metric === "revenue" ? egp : (n: number) => Math.round(n).toLocaleString("en");

  return (
    <div>
      <PageHeader
        eyebrow={<span className="text-[12.5px] font-medium text-a-dim">{dateLabel}</span>}
        title={greeting}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="relative flex size-2">
              <span className={cx("absolute inset-0 animate-ping rounded-full opacity-60", healthy ? "bg-a-ok" : "bg-a-warn")} />
              <span className={cx("relative size-2 rounded-full", healthy ? "bg-a-ok" : "bg-a-warn")} />
            </span>
            <span>
              <span className="text-a-text">{t("overview.health.todayOrders", { count: h.todayOrders, total: egp(h.todayRevenue) })}</span>
              {" · "}
              {h.pending ? (
                <Link href="/admin/orders?status=pending" className="text-a-warn underline-offset-2 hover:underline">
                  {t("overview.health.waiting", { count: h.pending })}
                </Link>
              ) : (
                t("overview.health.nothingWaiting")
              )}
              {" · "}
              {h.lowStock ? (
                <Link href="/admin/inventory" className="text-a-warn underline-offset-2 hover:underline">
                  {t("overview.health.lowStock", { count: h.lowStock })}
                </Link>
              ) : (
                t("overview.health.stockHealthy")
              )}
              {" · "}
              {t("overview.health.live", { count: h.activeProducts })}
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {pending ? <Spinner size={14} className="text-a-dim" /> : null}
            <Tabs value={data.range} onChange={setRange} items={RANGES.map((r) => ({ value: r, label: t(`overview.ranges.${r}`) }))} />
          </div>
        }
      />

      {top}

      <div className={cx("transition-opacity duration-200", pending && "pointer-events-none opacity-60")} aria-busy={pending}>
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {data.kpis.map((k) => {
            const m = KPI_META[k.key];
            return (
              <StaggerItem key={k.key}>
                <Stat label={t(`overview.kpi.${k.key}`)} value={k.value} format={m.format} delta={k.delta} icon={m.icon} tone={m.tone} spark={k.spark} hint={t("overview.kpi.vs", { value: m.format(k.prev) })} />
              </StaggerItem>
            );
          })}
        </Stagger>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <motion.div initial={first && { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.15 }}>
            <Card
              glow
              title={t(`overview.kpi.${metric}`)}
              description={t("overview.chart.comparedWith", { unit: t(data.unit === "hour" ? "overview.chart.byHour" : "overview.chart.byDay"), prev: t(`overview.prev.${data.range}`) })}
              actions={
                <Tabs
                  size="sm"
                  value={metric}
                  onChange={setMetric}
                  items={[
                    { value: "revenue", label: t("overview.kpi.revenue") },
                    { value: "orders", label: t("overview.kpi.orders") },
                  ]}
                />
              }
            >
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[30px] font-semibold tracking-[-0.03em] tabular-nums">{fmt(total.value)}</span>
                  {total.delta !== null ? (
                    <span dir="ltr" className={cx("inline-flex items-center gap-0.5 text-[12.5px] font-medium", total.delta >= 0 ? "text-a-ok" : "text-a-danger")}>
                      <AIcon name={total.delta >= 0 ? "trendUp" : "trendDown"} size={14} />
                      {Math.abs(total.delta).toFixed(1)}%
                    </span>
                  ) : null}
                </div>
                <Legend
                  items={[
                    { label: data.range === "today" ? t("common.today") : t("overview.chart.thisPeriod"), color: CHART_COLORS[0] },
                    { label: data.range === "today" ? t("common.yesterday") : t("overview.chart.previousPeriod"), color: "var(--color-a-dim)", dashed: true },
                  ]}
                />
              </div>
              <AreaChart
                key={`${data.range}-${metric}`}
                data={data.series}
                series={[
                  { key: metric === "revenue" ? "prevRevenue" : "prevOrders", label: data.range === "today" ? t("common.yesterday") : t("overview.chart.previous"), color: "var(--color-a-dim)", dashed: true },
                  { key: metric, label: data.range === "today" ? t("common.today") : t("overview.chart.thisPeriod"), color: CHART_COLORS[0] },
                ]}
                format={fmt}
                height={280}
                ariaLabel={t("overview.chart.overTime", { metric: t(`overview.kpi.${metric}`) })}
              />
            </Card>
          </motion.div>

          <motion.div initial={first && { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.22 }}>
            <Card title={t("overview.attention.title")} description={t("overview.attention.description")} className="h-full">
              <ul className="-mx-2 space-y-1">
                {data.attention.map((a, i) => (
                  <motion.li key={a.key} initial={first && { opacity: 0, x: isRtl ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease, delay: 0.3 + i * 0.06 }}>
                    <Link href={a.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-a-ink/[0.035]">
                      <span className={cx("grid size-9 shrink-0 place-items-center rounded-[10px] ring-1 ring-inset", a.count ? toneBg[a.tone] : "bg-a-ink/[0.04] text-a-faint ring-a-ink/[0.06]")}>
                        <AIcon name={a.icon} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium">{a.label}</span>
                        <span className="block truncate text-[12px] text-a-faint">{a.detail}</span>
                      </span>
                      {a.count ? <Badge tone={a.tone}>{a.count}</Badge> : <AIcon name="check" size={16} className="text-a-ok" />}
                      <AIcon name="chevronRight" size={15} className="text-a-faint transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </Card>
          </motion.div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title={t("overview.top.title")} description={t("overview.top.description")} actions={<Link href="/admin/analytics" className="inline-flex items-center gap-0.5 text-[12.5px] text-a-dim transition hover:text-a-text">{t("overview.top.analyticsLink")} <AIcon name="chevronRight" size={13} className="rtl:-scale-x-100" /></Link>}>
            <BarList
              format={egp}
              empty={t("overview.top.noSales")}
              items={data.topProducts.map((p) => ({ key: p.id, label: p.title, value: p.revenue, image: p.image, sub: t("overview.top.unitsSold", { count: p.units }), href: `/admin/products/${p.id}` }))}
            />
          </Card>
          <Card title={t("overview.gov.title")} description={t("overview.gov.description")}>
            <BarList
              color={CHART_COLORS[1]}
              empty={t("overview.gov.empty")}
              items={data.governorates.slice(0, 8).map((g) => ({ key: g.name, label: g.name, value: g.orders, display: t("overview.gov.orders", { count: g.orders }), sub: egp(g.revenue) }))}
            />
            {data.governorates.length > 8 ? <p className="mt-2 text-[12px] text-a-faint">{t("overview.gov.more", { count: data.governorates.length - 8 })}</p> : null}
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card title={t("overview.recent.title")} padded={false} actions={<Link href="/admin/orders" className="inline-flex items-center gap-0.5 text-[12.5px] text-a-dim transition hover:text-a-text">{t("overview.recent.viewAll")} <AIcon name="chevronRight" size={13} className="rtl:-scale-x-100" /></Link>}>
            {data.recentOrders.length ? (
              <div className={table.wrap}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th className={cx(table.th, "text-start")}>{t("overview.recent.order")}</th>
                      <th className={cx(table.th, "text-start")}>{t("overview.recent.customer")}</th>
                      <th className={cx(table.th, "text-start")}>{t("overview.recent.status")}</th>
                      <th className={cx(table.th, "text-end")}>{t("overview.recent.total")}</th>
                      <th className={cx(table.th, "text-end")}>{t("overview.recent.placed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((o, i) => (
                      <motion.tr key={o.id} className={cx(table.tr, "cursor-pointer")} initial={first && { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.03 }} onClick={() => router.push(`/admin/orders/${o.id}`)}>
                        <td className={table.td}>
                          <Link href={`/admin/orders/${o.id}`} dir="ltr" className="font-medium tabular-nums hover:text-a-accent" onClick={(e) => e.stopPropagation()}>
                            {o.number}
                          </Link>
                        </td>
                        <td className={table.td}>
                          <span className="block">{o.name}</span>
                          <span className="text-[12px] text-a-faint">
                            {t("overview.recent.items", { count: o.items })}
                          </span>
                        </td>
                        <td className={table.td}>
                          <Badge tone={STATUS_TONE[o.status]} dot>
                            {t(`overview.status.${o.status}`)}
                          </Badge>
                        </td>
                        <td className={cx(table.td, "text-end font-medium tabular-nums")}><Ltr>{egp(o.total)}</Ltr></td>
                        <td className={cx(table.td, "text-end text-a-dim")} suppressHydrationWarning>
                          {f.ago(o.createdAt)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="orders" title={t("overview.recent.empty")} description={t("overview.recent.emptyHint")} />
            )}
          </Card>

          <Card title={t("overview.activityCard.title")} actions={<Link href="/admin/activity" className="inline-flex items-center gap-0.5 text-[12.5px] text-a-dim transition hover:text-a-text">{t("overview.activityCard.all")} <AIcon name="chevronRight" size={13} className="rtl:-scale-x-100" /></Link>}>
            {data.activity.length ? (
              <ol className="relative space-y-4 before:absolute before:bottom-2 before:start-[13px] before:top-2 before:w-px before:bg-a-line">
                {data.activity.map((a, i) => {
                  const meta = activityMeta(a.action);
                  return (
                    <motion.li key={a.id} className="relative flex gap-3" initial={first && { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.25 + i * 0.04 }}>
                      <span className="relative grid size-[27px] shrink-0 place-items-center rounded-full border border-a-line bg-a-panel-2" style={{ color: meta.color }}>
                        <AIcon name={meta.icon} size={13} />
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="block text-[13px] leading-snug">
                          {activityLabel(t, a.action)}
                          {a.target ? <span className="text-a-dim"> · {activityDetail(t, a.target)}</span> : null}
                        </span>
                        <span className="text-[11.5px] text-a-faint" suppressHydrationWarning>
                          {f.ago(a.at)} · {actorLabel(t, a.actor)}
                        </span>
                      </span>
                    </motion.li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-6 text-center text-[13px] text-a-faint">{t("overview.activityCard.empty")}</p>
            )}
          </Card>
        </div>
      </div>
      {bottom}
    </div>
  );
}

const toneBg: Record<string, string> = {
  amber: "bg-a-warn/12 text-a-warn ring-a-warn/20",
  red: "bg-a-danger/12 text-a-danger ring-a-danger/20",
  violet: "bg-a-violet/15 text-a-accent ring-a-violet/25",
  blue: "bg-a-blue/12 text-a-blue ring-a-blue/20",
};
