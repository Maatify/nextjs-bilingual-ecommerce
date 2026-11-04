"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { advanceOrders } from "@/app/admin/(panel)/orders/actions";
import { cx } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import type { OrderFilters } from "@/server/queries/sales";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Button, Card, Checkbox, EmptyState, IconBtn, Input, LinkButton, PageHeader, Select, Spinner, Tabs, buttonClass, ease, egp, table, toast } from "../ui";
import { DemoBadge, PaymentBadge, PaymentMethod, StatusBadge, ThumbStack } from "./bits";
import { BULK_STEPS, fmtDate } from "./meta";

type TabValue = OrderStatus | "all";
const TABS: TabValue[] = ["all", "pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"];

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return day(d);
};
const PRESETS = [
  { value: "any", key: "any" },
  { value: "today", key: "today", days: 0 },
  { value: "7d", key: "d7", days: 6 },
  { value: "30d", key: "d30", days: 29 },
  { value: "90d", key: "d90", days: 89 },
  { value: "custom", key: "custom" },
] as const;

export function OrdersList({ filters, rows, total, tabCounts, pages }: { filters: OrderFilters; rows: Order[]; total: number; tabCounts: Record<TabValue, number>; pages: number }) {
  const router = useRouter();
  const { t, fmt, isRtl } = useT();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const navigate = (patch: Partial<Record<keyof OrderFilters, string | number>>) => {
    const next = { ...filters, page: 1, ...patch } as Record<string, string | number>;
    const sp = new URLSearchParams();
    for (const k of ["status", "q", "from", "to", "page"]) {
      const v = next[k];
      if (v === undefined || v === "" || (k === "status" && v === "all") || (k === "page" && Number(v) <= 1)) continue;
      sp.set(k, String(v));
    }
    const qs = sp.toString();
    setSelected(new Set());
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // debounce search → URL
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (q.trim() !== filters.q) navigate({ q: q.trim() });
    }, 320);
    return () => clearTimeout(timer);
    // debounce reacts to typing only; filters/navigate change on every URL update and would re-fire the search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const preset = useMemo(() => {
    if (!filters.from && !filters.to) return "any";
    const today = day(new Date());
    if (filters.to === today || !filters.to) {
      const p = PRESETS.find((p) => "days" in p && filters.from === daysAgo(p.days));
      if (p && filters.to) return p.value;
    }
    return "custom";
  }, [filters.from, filters.to]);

  const onPreset = (v: string) => {
    if (v === "any") return (setCustomOpen(false), navigate({ from: "", to: "" }));
    if (v === "custom") return setCustomOpen(true);
    const p = PRESETS.find((x) => x.value === v);
    if (p && "days" in p) {
      setCustomOpen(false);
      navigate({ from: daysAgo(p.days), to: day(new Date()) });
    }
  };

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulk = async (to: OrderStatus) => {
    setBusy(to);
    const res = await advanceOrders([...selected], to);
    setBusy(null);
    if (!res.ok) return toast.error(t("sales.orders.bulkFail"), res.error);
    const { updated = 0, skipped = 0 } = res.data ?? {};
    toast.success(t("sales.orders.bulkDone", { count: updated, status: t(`sales.status.${to}`) }), skipped ? t("sales.orders.bulkSkipped", { count: skipped }) : undefined);
    setSelected(new Set());
    router.refresh();
  };

  const exportHref = useMemo(() => {
    const sp = new URLSearchParams();
    if (filters.status !== "all") sp.set("status", filters.status);
    if (filters.q) sp.set("q", filters.q);
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    return `/admin/orders/export${sp.size ? `?${sp}` : ""}`;
  }, [filters]);

  const from = (filters.page - 1) * 25 + 1;
  const showCustom = customOpen || preset === "custom";

  return (
    <>
      <PageHeader
        title={t("sales.orders.title")}
        description={t("sales.orders.description")}
        actions={
          <>
            <a href={exportHref} className={buttonClass("secondary", "md")} download>
              <AIcon name="download" size={16} /> {t("sales.orders.export")}
            </a>
            <LinkButton href="/admin/orders/drafts" icon="edit">
              {t("sales.orders.drafts")}
            </LinkButton>
            <LinkButton href="/admin/orders/new" variant="primary" icon="plus">
              {t("sales.orders.createOrder")}
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <Tabs<TabValue> value={filters.status} onChange={(v) => navigate({ status: v })} items={TABS.map((s) => ({ value: s, label: s === "all" ? t("common.all") : t(`sales.status.${s}`), count: tabCounts[s] }))} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sales.orders.searchPh")} aria-label={t("sales.orders.searchAria")} className="ps-9" />
          </div>
          <Select value={showCustom ? "custom" : preset} onChange={(e) => onPreset(e.target.value)} aria-label={t("sales.orders.dateRange")} className="sm:w-44">
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {t(`sales.orders.presets.${p.key}`)}
              </option>
            ))}
          </Select>
          <AnimatePresence initial={false}>
            {showCustom ? (
              <motion.div initial={{ opacity: 0, x: isRtl ? 6 : -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRtl ? 6 : -6 }} transition={{ duration: 0.2, ease }} className="flex items-center gap-2">
                <Input type="date" aria-label={t("sales.orders.fromDate")} dir="ltr" value={filters.from} max={filters.to || undefined} onChange={(e) => navigate({ from: e.target.value })} className="sm:w-40" />
                <span className="text-a-faint">–</span>
                <Input type="date" aria-label={t("sales.orders.toDate")} dir="ltr" value={filters.to} min={filters.from || undefined} onChange={(e) => navigate({ to: e.target.value })} className="sm:w-40" />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {pending ? <Spinner className="text-a-dim sm:ms-1" /> : null}
        </div>
      </div>

      <Card padded={false} className={cx("transition-opacity duration-200", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <EmptyState
            icon="orders"
            title={filters.q || filters.from || filters.status !== "all" ? t("sales.orders.emptyFiltered") : t("sales.orders.empty")}
            description={filters.q || filters.from || filters.status !== "all" ? t("sales.orders.emptyFilteredDesc") : t("sales.orders.emptyDesc")}
            action={filters.q || filters.from || filters.status !== "all" ? <Button size="sm" onClick={() => (setQ(""), navigate({ status: "all", q: "", from: "", to: "" }))}>{t("sales.orders.clearFilters")}</Button> : null}
          />
        ) : (
          <>
            {/* desktop table */}
            <div className={cx(table.wrap, "hidden md:block")}>
              <table className={cx(table.table, "min-w-[980px]")}>
                <thead>
                  <tr>
                    <th className={cx(table.th, "w-10 pe-0")}>
                      <Checkbox checked={allOnPage} onChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} label={<span className="sr-only">{t("sales.orders.selectAll")}</span>} />
                    </th>
                    <th className={table.th}>{t("sales.orders.th.order")}</th>
                    <th className={table.th}>{t("sales.orders.th.date")}</th>
                    <th className={table.th}>{t("sales.orders.th.customer")}</th>
                    <th className={table.th}>{t("sales.orders.th.governorate")}</th>
                    <th className={table.th}>{t("sales.orders.th.items")}</th>
                    <th className={table.th}>{t("sales.orders.th.payment")}</th>
                    <th className={table.th}>{t("sales.orders.th.status")}</th>
                    <th className={cx(table.th, "text-end")}>{t("sales.orders.th.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o, i) => (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease, delay: Math.min(i, 16) * 0.018 }}
                      className={cx(table.tr, "group cursor-pointer", selected.has(o.id) && "bg-a-violet/[0.06]")}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button,a,input,label")) return;
                        router.push(`/admin/orders/${o.id}`);
                      }}
                    >
                      <td className={cx(table.td, "pe-0")}>
                        <Checkbox checked={selected.has(o.id)} onChange={() => toggle(o.id)} label={<span className="sr-only">{t("sales.orders.selectOne", { number: o.number })}</span>} />
                      </td>
                      <td className={table.td}>
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/orders/${o.id}`} className="font-medium tabular-nums hover:text-a-accent" dir="ltr">
                            {o.number}
                          </Link>
                          {o.demo ? <DemoBadge /> : null}
                        </div>
                      </td>
                      <td className={cx(table.td, "whitespace-nowrap text-a-dim")} title={fmtDate(fmt, o.createdAt)} suppressHydrationWarning>
                        {fmt.ago(o.createdAt)}
                      </td>
                      <td className={table.td}>
                        <div className="max-w-[180px] truncate font-medium">{o.customer.name}</div>
                        <div className="text-[12px] tabular-nums text-a-faint"><bdi dir="ltr">{o.customer.phone}</bdi></div>
                      </td>
                      <td className={cx(table.td, "text-a-dim")}>{o.address.governorate}</td>
                      <td className={table.td}>
                        <ThumbStack lines={o.lines} />
                      </td>
                      <td className={table.td}>
                        <div className="flex flex-col items-start gap-1">
                          <PaymentMethod method={o.paymentMethod} />
                          <PaymentBadge status={o.paymentStatus} />
                        </div>
                      </td>
                      <td className={table.td}>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={cx(table.td, "text-end font-medium tabular-nums")}><bdi dir="ltr">{egp(o.totals.total)}</bdi></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <ul className="divide-y divide-a-line md:hidden">
              {rows.map((o) => (
                <li key={o.id} className={cx("flex items-start gap-3 px-4 py-3.5", selected.has(o.id) && "bg-a-violet/[0.06]")}>
                  <div className="pt-0.5">
                    <Checkbox checked={selected.has(o.id)} onChange={() => toggle(o.id)} label={<span className="sr-only">{t("sales.orders.selectOne", { number: o.number })}</span>} />
                  </div>
                  <Link href={`/admin/orders/${o.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium tabular-nums">
                        <bdi dir="ltr">{o.number}</bdi> {o.demo ? <DemoBadge /> : null}
                      </span>
                      <span className="font-medium tabular-nums"><bdi dir="ltr">{egp(o.totals.total)}</bdi></span>
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-a-dim">
                      {o.customer.name} · {o.address.governorate} · <span suppressHydrationWarning>{fmt.ago(o.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={o.status} />
                      <PaymentBadge status={o.paymentStatus} />
                      <span className="ms-auto">
                        <ThumbStack lines={o.lines} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-a-line px-4 py-3 text-[12.5px] text-a-dim">
              <span className="tabular-nums">
                {t("sales.orders.range", { from, to: from + rows.length - 1, total })}
              </span>
              <div className="flex items-center gap-1">
                <IconBtn icon="chevronLeft" label={t("sales.orders.prevPage")} disabled={filters.page <= 1 || pending} onClick={() => navigate({ page: filters.page - 1 })} className="disabled:opacity-30 rtl:-scale-x-100" />
                <span className="px-2 tabular-nums">
                  {t("sales.orders.page", { page: filters.page, pages })}
                </span>
                <IconBtn icon="chevronRight" label={t("sales.orders.nextPage")} disabled={filters.page >= pages || pending} onClick={() => navigate({ page: filters.page + 1 })} className="disabled:opacity-30 rtl:-scale-x-100" />
              </div>
            </div>
          </>
        )}
      </Card>

      {/* bulk bar */}
      <AnimatePresence>
        {selected.size ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="fixed inset-x-0 bottom-4 z-[70] mx-auto flex w-[min(720px,calc(100vw-2rem))] flex-wrap items-center gap-2 rounded-2xl border border-a-line-strong bg-a-panel-2/95 p-2 ps-4 shadow-[0_24px_60px_-20px_var(--a-shadow)] backdrop-blur md:start-[248px]"
            role="toolbar"
            aria-label={t("sales.orders.bulkAria")}
          >
            <span className="me-auto text-[13px] font-medium tabular-nums">{t("common.selected", { count: selected.size })}</span>
            {BULK_STEPS.map((s) => (
              <Button key={s.to} size="sm" variant="ghost" icon={s.icon} loading={busy === s.to} disabled={!!busy} onClick={() => bulk(s.to)}>
                {t(`sales.bulkStep.${s.to}`)}
              </Button>
            ))}
            <LinkButton size="sm" variant="secondary" icon="download" href={`/admin/orders/export?ids=${[...selected].join(",")}`} external>
              CSV
            </LinkButton>
            <IconBtn icon="close" label={t("sales.orders.clearSelection")} onClick={() => setSelected(new Set())} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
