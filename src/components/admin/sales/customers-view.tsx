"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";
import { cx } from "@/lib/format";
import type { CustomerRow } from "@/server/queries/sales";
import { AIcon } from "../icons";
import type { TFn } from "@/lib/i18n/admin";
import { useT } from "../i18n";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Stat, Tabs, ease, egp, table, toast } from "../ui";
import { DemoBadge, copyText } from "./bits";
import { fmtDate } from "./meta";

type Segment = "all" | "repeat" | "vip" | "risk" | "new" | "subscribers";
type Sort = "last" | "spent" | "orders" | "aov" | "first" | "name";
type Subscriber = { id: number; contact: string; source: string; createdAt: string };

const DAY = 864e5;
export const VIP_SPEND = 5000;

export function segmentsOf(c: CustomerRow, now: number) {
  return {
    repeat: c.orders >= 2,
    vip: c.spent >= VIP_SPEND,
    risk: now - new Date(c.lastAt).getTime() > 45 * DAY,
    new: now - new Date(c.firstAt).getTime() <= 30 * DAY,
  };
}

const SORTS: Sort[] = ["last", "spent", "orders", "aov", "first", "name"];

function downloadCsv(name: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v);
    const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  // stable hue per name
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="grid shrink-0 place-items-center rounded-full text-[11.5px] font-semibold text-white/90" style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${h} 55% 45%), hsl(${(h + 50) % 360} 60% 38%))`, fontSize: size > 40 ? 16 : undefined }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function CustomersView({ customers, subscribers, now }: { customers: CustomerRow[]; subscribers: Subscriber[]; now: number }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const [seg, setSeg] = useState<Segment>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("last");
  const [limit, setLimit] = useState(30);
  const dq = useDeferredValue(q.trim().toLowerCase());

  const withSeg = useMemo(() => customers.map((c) => ({ c, s: segmentsOf(c, now) })), [customers, now]);
  const counts = useMemo(
    () => ({ all: customers.length, repeat: withSeg.filter((x) => x.s.repeat).length, vip: withSeg.filter((x) => x.s.vip).length, risk: withSeg.filter((x) => x.s.risk).length, new: withSeg.filter((x) => x.s.new).length, subscribers: subscribers.length }),
    [customers.length, withSeg, subscribers.length],
  );

  const rows = useMemo(() => {
    const digits = dq.replace(/\D/g, "");
    const list = withSeg.filter(({ c, s }) => {
      if (seg !== "all" && seg !== "subscribers" && !s[seg]) return false;
      if (!dq) return true;
      return c.name.toLowerCase().includes(dq) || (digits.length >= 3 && c.phone.includes(digits)) || c.governorate.toLowerCase().includes(dq) || (c.email ?? "").toLowerCase().includes(dq);
    });
    const by: Record<Sort, (a: CustomerRow, b: CustomerRow) => number> = {
      last: (a, b) => b.lastAt.localeCompare(a.lastAt),
      first: (a, b) => b.firstAt.localeCompare(a.firstAt),
      spent: (a, b) => b.spent - a.spent,
      orders: (a, b) => b.orders - a.orders || b.spent - a.spent,
      aov: (a, b) => b.aov - a.aov,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort((a, b) => by[sort](a.c, b.c));
  }, [withSeg, seg, dq, sort]);

  const subs = useMemo(() => subscribers.filter((s) => !dq || s.contact.toLowerCase().includes(dq) || s.source.toLowerCase().includes(dq)), [subscribers, dq]);

  const totalSpent = customers.reduce((n, c) => n + c.spent, 0);
  const repeatRate = customers.length ? (counts.repeat / customers.length) * 100 : 0;

  const exportCurrent = () => {
    if (seg === "subscribers") return downloadCsv("verda-subscribers.csv", [["Contact", "Source", "Subscribed"], ...subs.map((s) => [s.contact, s.source, s.createdAt])]);
    downloadCsv(`verda-customers-${seg}.csv`, [["Name", "Phone", "Email", "Governorate", "City", "Orders", "Total spent", "AOV", "First order", "Last order"], ...rows.map(({ c }) => [c.name, c.phone, c.email ?? "", c.governorate, c.city, c.orders, c.spent, c.aov, c.firstAt, c.lastAt])]);
  };

  return (
    <>
      <PageHeader
        title={t("sales.customers.title")}
        description={t("sales.customers.description")}
        actions={
          <Button icon="download" onClick={exportCurrent}>
            {t("sales.customers.exportCsv")}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("sales.customers.title")} value={customers.length} icon="customers" />
        <Stat label={t("sales.customers.repeatRate")} value={repeatRate} format={(n) => `${n.toFixed(1)}%`} icon="refresh" tone="#5ee0a0" />
        <Stat label={t("sales.customers.ltv")} value={customers.length ? totalSpent / customers.length : 0} format={egp} icon="trendUp" tone="#f472b6" />
        <Stat label={t("sales.customers.vipStat", { min: egp(VIP_SPEND) })} value={counts.vip} icon="sparkle" tone="#f5b545" />
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <Tabs<Segment>
          value={seg}
          onChange={(v) => {
            setSeg(v);
            setLimit(30);
          }}
          items={[
            { value: "all", label: t("common.all"), count: counts.all },
            { value: "repeat", label: t("sales.customers.seg.repeat"), count: counts.repeat },
            { value: "vip", label: t("sales.customers.seg.vip"), count: counts.vip },
            { value: "risk", label: t("sales.customers.seg.risk"), count: counts.risk },
            { value: "new", label: t("sales.customers.seg.new"), count: counts.new },
            { value: "subscribers", label: t("sales.customers.seg.subscribers"), count: counts.subscribers },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={seg === "subscribers" ? t("sales.customers.searchSubsPh") : t("sales.customers.searchPh")} aria-label={t("sales.customers.searchAria")} className="ps-9" />
          </div>
          {seg !== "subscribers" ? (
            <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t("sales.customers.sortBy")} className="sm:w-48">
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t("sales.customers.sortPrefix", { label: t(`sales.customers.sort.${s}`) })}
                </option>
              ))}
            </Select>
          ) : null}
          <p className="text-[12.5px] text-a-faint sm:ms-auto">{segmentHint(seg, t)}</p>
        </div>
      </div>

      {seg === "subscribers" ? (
        <Card padded={false}>
          {subs.length ? (
            <div className={table.wrap}>
              <table className={cx(table.table, "min-w-[520px]")}>
                <thead>
                  <tr>
                    <th className={table.th}>{t("sales.customers.th.contact")}</th>
                    <th className={table.th}>{t("sales.customers.th.source")}</th>
                    <th className={table.th}>{t("sales.customers.th.subscribed")}</th>
                    <th className={cx(table.th, "w-12")} />
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s, i) => (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: Math.min(i, 20) * 0.015 }} className={table.tr}>
                      <td className={cx(table.td, "font-medium")}><bdi dir="ltr">{s.contact}</bdi></td>
                      <td className={table.td}>
                        <Badge tone="violet">{s.source}</Badge>
                      </td>
                      <td className={cx(table.td, "text-a-dim")} title={fmtDate(fmt, s.createdAt)} suppressHydrationWarning>
                        {fmt.ago(s.createdAt)}
                      </td>
                      <td className={table.td}>
                        <button className="text-a-faint hover:text-a-text" aria-label={t("sales.customers.copy", { value: s.contact })} onClick={() => copyText(s.contact, toast.success, t("common.copied"))}>
                          <AIcon name="copy" size={15} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="mail" title={q ? t("sales.customers.noSubsMatch") : t("sales.customers.noSubs")} description={t("sales.customers.noSubsDesc")} />
          )}
        </Card>
      ) : (
        <Card padded={false}>
          {rows.length ? (
            <>
              <div className={table.wrap}>
                <table className={cx(table.table, "min-w-[860px]")}>
                  <thead>
                    <tr>
                      <th className={table.th}>{t("sales.customers.th.customer")}</th>
                      <th className={table.th}>{t("sales.customers.th.governorate")}</th>
                      <th className={cx(table.th, "text-end")}>{t("sales.customers.th.orders")}</th>
                      <th className={cx(table.th, "text-end")}>{t("sales.customers.th.spent")}</th>
                      <th className={cx(table.th, "text-end")}>{t("sales.customers.th.aov")}</th>
                      <th className={table.th}>{t("sales.customers.th.last")}</th>
                      <th className={table.th}>{t("sales.customers.th.first")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, limit).map(({ c, s }, i) => (
                      <motion.tr
                        key={c.phone}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease, delay: Math.min(i % 30, 16) * 0.016 }}
                        className={cx(table.tr, "cursor-pointer")}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("a,button")) return;
                          router.push(`/admin/customers/${c.phone}`);
                        }}
                      >
                        <td className={table.td}>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Link href={`/admin/customers/${c.phone}`} className="truncate font-medium hover:text-a-accent">
                                  {c.name}
                                </Link>
                                {s.vip ? <Badge tone="amber">{t("sales.customers.seg.vip")}</Badge> : null}
                                {s.risk && s.repeat ? <Badge tone="red">{t("sales.customers.seg.risk")}</Badge> : null}
                                {s.new ? <Badge tone="blue">{t("sales.customers.seg.new")}</Badge> : null}
                                {c.demo ? <DemoBadge /> : null}
                              </div>
                              <div className="text-[12px] tabular-nums text-a-faint"><bdi dir="ltr">{c.phone}</bdi></div>
                            </div>
                          </div>
                        </td>
                        <td className={cx(table.td, "text-a-dim")}>{c.governorate}</td>
                        <td className={cx(table.td, "text-end tabular-nums")}>{c.orders}</td>
                        <td className={cx(table.td, "text-end font-medium tabular-nums")}><bdi dir="ltr">{egp(c.spent)}</bdi></td>
                        <td className={cx(table.td, "text-end tabular-nums text-a-dim")}><bdi dir="ltr">{egp(c.aov)}</bdi></td>
                        <td className={cx(table.td, "whitespace-nowrap text-a-dim")} title={fmtDate(fmt, c.lastAt)} suppressHydrationWarning>
                          {fmt.ago(c.lastAt)}
                        </td>
                        <td className={cx(table.td, "whitespace-nowrap text-a-faint")}>{fmtDate(fmt, c.firstAt, false)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-a-line px-4 py-3 text-[12.5px] text-a-dim">
                <span className="tabular-nums">
                  {t("sales.customers.showing", { shown: Math.min(limit, rows.length), total: rows.length })}
                </span>
                {rows.length > limit ? (
                  <Button size="sm" variant="ghost" icon="chevronDown" onClick={() => setLimit((l) => l + 30)}>
                    {t("common.showMore")}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState icon="customers" title={q ? t("sales.customers.noMatch") : t("sales.customers.emptySeg")} description={q ? t("sales.customers.tryAnother") : segmentHint(seg, t)} />
          )}
        </Card>
      )}
    </>
  );
}

function segmentHint(seg: Segment, t: TFn) {
  return seg === "all" ? "" : t(`sales.customers.hint.${seg}`, { min: egp(VIP_SPEND) });
}
