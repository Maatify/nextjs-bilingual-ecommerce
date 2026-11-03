"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { cx } from "@/lib/format";
import type { CustomerDetail } from "@/server/queries/sales";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Badge, Card, IconBtn, LinkButton, PageHeader, Sparkline, Stagger, StaggerItem, Stat, ease, egp, table, toast } from "../ui";
import { Thumb, ThumbStack, StatusBadge, copyText } from "./bits";
import { Avatar, segmentsOf, VIP_SPEND } from "./customers-view";
import { firstName, fmtDate, waNumber } from "./meta";

export function CustomerDetailView({ detail: d, storeName, now }: { detail: CustomerDetail; storeName: string; now: number }) {
  const { t, fmt } = useT();
  const c = d.row;
  const seg = segmentsOf(c, now);
  const wa = `https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(t("sales.customer.waHello", { name: firstName(c.name), store: storeName }))}`;
  const addr = [d.address.street, d.address.building, d.address.landmark ? t("sales.order.near", { landmark: d.address.landmark }) : "", `${d.address.city}, ${d.address.governorate}`].filter(Boolean);
  const maxMonth = Math.max(1, ...d.monthly.map((m) => m.value));
  const daysSince = Math.floor((now - new Date(c.lastAt).getTime()) / 864e5);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: t("sales.customers.title") }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={c.name} size={44} />
            {c.name}
            {seg.vip ? <Badge tone="amber">{t("sales.customers.seg.vip")}</Badge> : null}
            {seg.repeat ? <Badge tone="violet">{t("sales.customers.seg.repeat")}</Badge> : null}
            {seg.risk ? <Badge tone="red">{t("sales.customers.seg.risk")}</Badge> : null}
            {seg.new ? <Badge tone="blue">{t("sales.customers.seg.new")}</Badge> : null}
          </span>
        }
        description={t("sales.customer.since", { date: fmtDate(fmt, c.firstAt, false), governorate: c.governorate })}
        actions={
          <>
            <LinkButton href={`tel:${c.phone}`} icon="phone" external>
              {t("sales.order.call")}
            </LinkButton>
            <LinkButton href={wa} icon="whatsapp" variant="primary" external>
              WhatsApp
            </LinkButton>
          </>
        }
      />

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem>
          <Stat label={t("sales.customers.th.orders")} value={c.orders} icon="orders" hint={c.allOrders > c.orders ? t("sales.customer.closedHint", { count: c.allOrders - c.orders }) : t("sales.customer.allGood")} />
        </StaggerItem>
        <StaggerItem>
          <Stat label={t("sales.customers.th.spent")} value={c.spent} format={egp} icon="cash" tone="#5ee0a0" hint={seg.vip ? t("sales.customer.vip") : t("sales.customer.toVip", { amount: egp(Math.max(0, VIP_SPEND - c.spent)) })} />
        </StaggerItem>
        <StaggerItem>
          <Stat label={t("sales.customers.sort.aov")} value={c.aov} format={egp} icon="receipt" tone="#f472b6" />
        </StaggerItem>
        <StaggerItem>
          <Stat label={t("sales.customer.daysSince")} value={daysSince} icon="calendar" tone="#f5b545" hint={fmt.ago(c.lastAt)} />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title={t("sales.customer.ltv")} description={t("sales.customer.ltvDesc")}>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <p className="text-[24px] font-semibold tabular-nums tracking-[-0.02em]" dir="ltr">{egp(c.spent)}</p>
                {d.lifetime.length > 1 ? <Sparkline data={d.lifetime} className="mt-3 h-24" /> : <p className="mt-3 text-[12.5px] text-a-faint">{t("sales.customer.noTrend")}</p>}
              </div>
              <div className="flex h-[120px] items-end gap-2" role="img" aria-label={t("sales.customer.monthlyAria")} dir="ltr">
                {d.monthly.map((m, i) => (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="relative flex w-full flex-1 items-end">
                      <motion.div
                        className={cx("w-full rounded-t-md", m.value ? "a-grad" : "bg-a-ink/[0.07]")}
                        initial={{ height: 0 }}
                        animate={{ height: m.value ? `${Math.max(6, (m.value / maxMonth) * 100)}%` : 3 }}
                        transition={{ duration: 0.6, ease, delay: 0.1 + i * 0.05 }}
                        title={`${fmt.month(m.month)}: ${egp(m.value)}`}
                      />
                    </div>
                    <span className="text-[11px] text-a-faint">{fmt.month(m.month)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title={t("sales.customer.history")} description={t("sales.draft.customerOrders", { count: c.allOrders })} padded={false}>
            <div className={table.wrap}>
              <table className={cx(table.table, "min-w-[600px]")}>
                <thead>
                  <tr>
                    <th className={table.th}>{t("sales.orders.th.order")}</th>
                    <th className={table.th}>{t("sales.orders.th.date")}</th>
                    <th className={table.th}>{t("sales.orders.th.items")}</th>
                    <th className={table.th}>{t("sales.orders.th.status")}</th>
                    <th className={cx(table.th, "text-end")}>{t("sales.orders.th.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.orders.map((o) => (
                    <tr key={o.id} className={table.tr}>
                      <td className={table.td}>
                        <Link href={`/admin/orders/${o.id}`} className="font-medium tabular-nums hover:text-a-accent" dir="ltr">
                          {o.number}
                        </Link>
                      </td>
                      <td className={cx(table.td, "text-a-dim")}>{fmtDate(fmt, o.createdAt, false)}</td>
                      <td className={table.td}>
                        <ThumbStack lines={o.lines} />
                      </td>
                      <td className={table.td}>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={cx(table.td, "text-end font-medium tabular-nums")}><bdi dir="ltr">{egp(o.totals.total)}</bdi></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title={t("sales.checkouts.contact")}>
            <div className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 tabular-nums text-a-dim">
                  <AIcon name="phone" size={15} className="text-a-faint" /> <bdi dir="ltr">{c.phone}</bdi>
                </span>
                <IconBtn icon="copy" label={t("sales.order.copyPhone")} onClick={() => copyText(c.phone, toast.success, t("sales.order.phoneCopied"))} />
              </div>
              {c.email ? (
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 truncate text-a-dim hover:text-a-text">
                  <AIcon name="mail" size={15} className="text-a-faint" /> <bdi dir="ltr">{c.email}</bdi>
                </a>
              ) : null}
            </div>
          </Card>

          <Card title={t("sales.customer.latestAddress")} actions={<IconBtn icon="copy" label={t("sales.order.copyAddress")} onClick={() => copyText([c.name, c.phone, ...addr].join("\n"), toast.success, t("sales.order.addressCopied"))} />}>
            <address className="text-[13px] not-italic leading-relaxed text-a-dim">
              {addr.map((l, i) => (
                <span key={i} className={cx("block", i === addr.length - 1 && "text-a-text")}>
                  {l}
                </span>
              ))}
            </address>
          </Card>

          <Card title={t("sales.customer.favourites")}>
            <Bars title={t("sales.customer.sizes")} items={d.sizes} />
            <Bars title={t("sales.customer.colours")} items={d.colors} className="mt-5" />
            {d.products.length ? (
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-medium text-a-faint">{t("sales.customer.mostBought")}</p>
                <ul className="space-y-2">
                  {d.products.map((p) => (
                    <li key={p.title} className="flex items-center gap-2.5 text-[13px]">
                      <Thumb src={p.image} alt={p.title} size={32} />
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span className="tabular-nums text-a-faint" dir="ltr">×{p.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}

function Bars({ title, items, className }: { title: string; items: { label: string; n: number }[]; className?: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className={className}>
      <p className="mb-2 text-[12px] font-medium text-a-faint">{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-3 text-[12.5px]">
            <span className="w-24 shrink-0 truncate text-a-dim">{it.label}</span>
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-a-ink/[0.07]">
              <motion.span className="a-grad absolute inset-y-0 start-0 rounded-full" initial={{ width: 0 }} animate={{ width: `${(it.n / max) * 100}%` }} transition={{ duration: 0.6, ease, delay: i * 0.05 }} />
            </span>
            <span className="w-6 text-end tabular-nums text-a-faint">{it.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
