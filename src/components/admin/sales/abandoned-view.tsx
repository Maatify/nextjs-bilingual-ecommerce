"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { recordReminder, removeCheckouts } from "@/app/admin/(panel)/orders/checkouts/actions";
import { cx } from "@/lib/format";
import type { CheckoutSession } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import type { TFn } from "@/lib/i18n/admin";
import { Badge, Button, Card, Checkbox, ConfirmButton, Drawer, EmptyState, Input, PageHeader, Tabs, ease, egp, table, toast } from "../ui";
import { Thumb, copyText } from "./bits";
import { fmtDate, firstName, waNumber } from "./meta";

type Tab = "all" | "open" | "recovered";

const restoreUrl = (id: string) => `${typeof window === "undefined" ? "" : window.location.origin}/cart?restore=${encodeURIComponent(id)}`;

function recoveryMessage(s: CheckoutSession, store: string, t: TFn) {
  const name = s.customer.name ? firstName(s.customer.name) : "";
  const items = s.lines.map((l) => `• ${l.title} (${l.color}, ${l.size})${l.qty > 1 ? ` ×${l.qty}` : ""}`).join("\n");
  return t("sales.checkouts.message", { hi: name ? t("sales.checkouts.hiName", { name }) : t("sales.checkouts.hi"), store, items, url: restoreUrl(s.id) });
}

export function AbandonedView({ rows, storeName }: { rows: CheckoutSession[]; storeName: string }) {
  const router = useRouter();
  const { t: tr, fmt } = useT();
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [reminded, setReminded] = useState<Record<string, string>>({});

  const counts = useMemo(() => ({ all: rows.length, open: rows.filter((r) => !r.recoveredOrder).length, recovered: rows.filter((r) => r.recoveredOrder).length }), [rows]);
  const recoveredValue = rows.filter((r) => r.recoveredOrder).reduce((n, r) => n + r.total, 0);
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (tab === "all" || (tab === "recovered" ? !!r.recoveredOrder : !r.recoveredOrder)) &&
        (!t || [r.customer.name, r.customer.phone, r.customer.email, ...r.lines.map((l) => l.title)].some((x) => x?.toLowerCase().includes(t))),
    );
  }, [rows, tab, q]);
  const open = rows.find((r) => r.id === openId) ?? null;
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const sendWhatsApp = (s: CheckoutSession) => {
    if (!s.customer.phone) return;
    const url = `https://wa.me/${waNumber(s.customer.phone)}?text=${encodeURIComponent(recoveryMessage(s, storeName, tr))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    recordReminder(s.id).then((res) => {
      if (res.ok && res.data) {
        setReminded((m) => ({ ...m, [s.id]: res.data! }));
        router.refresh();
      }
    });
  };

  const remove = async (ids: string[]) => {
    const res = await removeCheckouts(ids);
    if (!res.ok) return toast.error(tr("sales.drafts.deleteFail"), res.error);
    toast.success(tr("sales.checkouts.deleted", { count: res.data ?? 0 }));
    setSelected(new Set());
    setOpenId(null);
    router.refresh();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: tr("sales.order.back") }}
        title={tr("sales.checkouts.title")}
        description={tr("sales.checkouts.description")}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: tr("sales.checkouts.notRecovered"), value: counts.open, icon: "bell" as const, tone: "text-a-warn" },
          { label: tr("sales.checkouts.recovered"), value: counts.recovered, icon: "check" as const, tone: "text-a-ok" },
          { label: tr("sales.checkouts.recoveredValue"), value: egp(recoveredValue), icon: "cash" as const, tone: "text-a-accent" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: i * 0.05 }} className="flex items-center gap-3 rounded-2xl border border-a-line bg-a-panel px-4 py-3.5">
            <span className={cx("grid size-9 place-items-center rounded-xl bg-a-ink/[0.05]", k.tone)}>
              <AIcon name={k.icon} size={17} />
            </span>
            <span>
              <span className="block text-[12px] text-a-faint">{k.label}</span>
              <span className="block text-[17px] font-semibold tabular-nums"><bdi dir="ltr">{k.value}</bdi></span>
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs<Tab>
          value={tab}
          onChange={(v) => (setTab(v), setSelected(new Set()))}
          items={[
            { value: "open", label: tr("sales.checkouts.notRecovered"), count: counts.open },
            { value: "recovered", label: tr("sales.checkouts.recovered"), count: counts.recovered },
            { value: "all", label: tr("common.all"), count: counts.all },
          ]}
        />
        <div className="relative flex-1 sm:ms-auto sm:max-w-xs">
          <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("sales.checkouts.searchPh")} aria-label={tr("sales.checkouts.searchAria")} className="ps-9" />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {selected.size ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden">
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-a-violet/30 bg-a-violet/[0.07] px-3 py-2">
              <span className="text-[13px] font-medium">{tr("common.selected", { count: selected.size })}</span>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                {tr("common.clear")}
              </Button>
              <span className="ms-auto">
                <ConfirmButton onConfirm={() => remove([...selected])} confirmLabel={tr("sales.drafts.deleteN", { count: selected.size })}>
                  {tr("common.delete")}
                </ConfirmButton>
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Card padded={false}>
        {!visible.length ? (
          <EmptyState
            icon="orders"
            title={rows.length ? tr("sales.checkouts.nothing") : tr("sales.checkouts.empty")}
            description={rows.length ? tr("sales.checkouts.tryAnother") : tr("sales.checkouts.emptyDesc")}
          />
        ) : (
          <div className={table.wrap}>
            <table className={cx(table.table, "min-w-[760px]")}>
              <thead>
                <tr>
                  <th className={cx(table.th, "w-10 pe-0")}>
                    <Checkbox checked={allChecked} onChange={(v) => setSelected(v ? new Set(visible.map((r) => r.id)) : new Set())} label={<span className="sr-only">{tr("sales.orders.selectAll")}</span>} />
                  </th>
                  <th className={table.th}>{tr("sales.orders.th.customer")}</th>
                  <th className={table.th}>{tr("sales.orders.th.items")}</th>
                  <th className={table.th}>{tr("sales.checkouts.started")}</th>
                  <th className={table.th}>{tr("sales.orders.th.status")}</th>
                  <th className={cx(table.th, "text-end")}>{tr("sales.orders.th.total")}</th>
                  <th className={cx(table.th, "w-12")} />
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease, delay: Math.min(i, 14) * 0.02 }}
                    className={cx(table.tr, "group cursor-pointer", selected.has(r.id) && "bg-a-violet/[0.06]")}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button,a,input,label")) return;
                      setOpenId(r.id);
                    }}
                  >
                    <td className={cx(table.td, "pe-0")}>
                      <Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} label={<span className="sr-only">{tr("sales.checkouts.select")}</span>} />
                    </td>
                    <td className={table.td}>
                      <button type="button" onClick={() => setOpenId(r.id)} className="block max-w-[200px] truncate text-start font-medium hover:text-a-accent">
                        {r.customer.name || tr("sales.checkouts.unknown")}
                      </button>
                      <div className="truncate text-[12px] tabular-nums text-a-faint"><bdi dir="ltr">{r.customer.phone ?? r.customer.email}</bdi></div>
                    </td>
                    <td className={table.td}>
                      <span className="flex items-center">
                        {r.lines.slice(0, 3).map((l, j) => (
                          <Thumb key={j} src={l.image} alt={l.title} size={30} className={cx("ring-2 ring-a-panel", j ? "-ms-2.5" : "")} />
                        ))}
                        {r.lines.length > 3 ? <span className="-ms-2 grid size-[30px] place-items-center rounded-[9px] bg-a-panel-2 text-[11px] text-a-dim ring-2 ring-a-panel"><bdi dir="ltr">+{r.lines.length - 3}</bdi></span> : null}
                        <span className="ms-2.5 text-[12px] text-a-faint">{tr("sales.order.itemsCount", { count: r.lines.reduce((n, l) => n + l.qty, 0) })}</span>
                      </span>
                    </td>
                    <td className={cx(table.td, "whitespace-nowrap text-a-dim")} title={fmtDate(fmt, r.createdAt)} suppressHydrationWarning>
                      {fmt.ago(r.updatedAt)}
                    </td>
                    <td className={table.td}>
                      <div className="flex flex-col items-start gap-1">
                        {r.recoveredOrder ? (
                          <Badge tone="green" dot>
                            {tr("sales.checkouts.recovered")}
                          </Badge>
                        ) : (
                          <Badge tone="amber" dot>
                            {tr("sales.checkouts.notRecovered")}
                          </Badge>
                        )}
                        {reminded[r.id] || r.remindedAt ? <span suppressHydrationWarning className="text-[11.5px] text-a-faint">{tr("sales.checkouts.reminded", { when: fmt.ago(reminded[r.id] || r.remindedAt!) })}</span> : null}
                      </div>
                    </td>
                    <td className={cx(table.td, "text-end font-medium tabular-nums")}><bdi dir="ltr">{egp(r.total)}</bdi></td>
                    <td className={table.td}>
                      {r.customer.phone && !r.recoveredOrder ? (
                        <button type="button" onClick={() => sendWhatsApp(r)} aria-label={tr("sales.checkouts.sendRecovery")} title={tr("sales.checkouts.sendRecovery")} className="fx-press grid size-8 place-items-center rounded-[9px] text-[#25d366] transition hover:bg-[#25d366]/12">
                          <AIcon name="whatsapp" size={17} />
                        </button>
                      ) : null}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-[12px] text-a-faint">{tr("sales.checkouts.footnote")}</p>

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? open.customer.name || tr("sales.checkouts.drawerTitle") : ""}
        footer={
          open ? (
            <>
              <span className="me-auto">
                <ConfirmButton onConfirm={() => remove([open.id])} confirmLabel={tr("sales.checkouts.clickDelete")}>
                  {tr("common.delete")}
                </ConfirmButton>
              </span>
              <Button variant="ghost" icon="copy" onClick={() => copyText(restoreUrl(open.id), (t) => toast.success(t), tr("sales.checkouts.linkCopied"))}>
                {tr("sales.checkouts.copyLink")}
              </Button>
              {open.customer.phone && !open.recoveredOrder ? (
                <Button variant="primary" icon="whatsapp" onClick={() => sendWhatsApp(open)}>
                  {tr("sales.checkouts.sendWa")}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {open ? <CheckoutDetail s={open} reminded={reminded[open.id] || open.remindedAt} storeName={storeName} /> : null}
      </Drawer>
    </>
  );
}

function CheckoutDetail({ s, reminded, storeName }: { s: CheckoutSession; reminded?: string; storeName: string }) {
  const { t: tr, fmt } = useT();
  const steps = [
    { label: tr("sales.checkouts.stepStarted"), at: s.createdAt, icon: "orders" as const },
    ...(s.updatedAt !== s.createdAt ? [{ label: tr("sales.checkouts.stepActivity"), at: s.updatedAt, icon: "refresh" as const }] : []),
    ...(reminded ? [{ label: tr("sales.checkouts.stepSent"), at: reminded, icon: "whatsapp" as const }] : []),
  ];
  return (
    <div className="grid gap-5">
      {s.recoveredOrder ? (
        <div className="flex items-center gap-3 rounded-xl border border-a-ok/30 bg-a-ok/[0.08] px-3.5 py-3 text-[13px]">
          <AIcon name="check" size={16} className="text-a-ok" />
          <span>
            {tr("sales.checkouts.recoveredOrder")}{" "}
            <Link href={`/admin/orders/${encodeURIComponent(s.recoveredOrder)}`} dir="ltr" className="font-medium text-a-accent hover:underline">
              {s.recoveredOrder}
            </Link>
          </span>
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 text-[12.5px] font-medium text-a-dim">{tr("sales.checkouts.bag")}</h3>
        <ul className="divide-y divide-a-line rounded-xl border border-a-line">
          {s.lines.map((l, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Thumb src={l.image} alt={l.title} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{l.title}</span>
                <span className="text-[12px] text-a-faint">
                  {l.color} · {l.size} · <bdi dir="ltr">×{l.qty}</bdi>
                </span>
              </span>
              <span className="text-[13px] tabular-nums"><bdi dir="ltr">{egp(l.unit * l.qty)}</bdi></span>
            </li>
          ))}
          <li className="flex items-center justify-between px-3 py-2.5 text-[13.5px] font-semibold">
            <span>{tr("sales.order.totals.subtotal")}</span>
            <span className="tabular-nums"><bdi dir="ltr">{egp(s.total)}</bdi></span>
          </li>
        </ul>
      </section>

      <section className="grid gap-1.5 text-[13px]">
        <h3 className="mb-1 text-[12.5px] font-medium text-a-dim">{tr("sales.checkouts.contact")}</h3>
        {s.customer.phone ? (
          <span className="flex items-center gap-2">
            <AIcon name="phone" size={14} className="text-a-faint" />
            <a href={`tel:${s.customer.phone}`} dir="ltr" className="tabular-nums hover:text-a-accent">
              {s.customer.phone}
            </a>
          </span>
        ) : null}
        {s.customer.email ? (
          <span className="flex items-center gap-2">
            <AIcon name="mail" size={14} className="text-a-faint" />
            <a href={`mailto:${s.customer.email}`} dir="ltr" className="hover:text-a-accent">
              {s.customer.email}
            </a>
          </span>
        ) : null}
        {s.governorate ? (
          <span className="flex items-center gap-2">
            <AIcon name="map" size={14} className="text-a-faint" />
            {s.governorate}
          </span>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-[12.5px] font-medium text-a-dim">{tr("sales.order.timeline.title")}</h3>
        <ol className="grid gap-2.5">
          {steps.map((st) => (
            <li key={st.label} className="flex items-center gap-3 text-[13px]">
              <span className="grid size-7 place-items-center rounded-full bg-a-ink/[0.05] text-a-dim">
                <AIcon name={st.icon} size={13} />
              </span>
              <span className="flex-1">{st.label}</span>
              <span className="text-[12px] text-a-faint">{fmtDate(fmt, st.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {s.customer.phone && !s.recoveredOrder ? (
        <section>
          <h3 className="mb-2 text-[12.5px] font-medium text-a-dim">{tr("sales.checkouts.preview")}</h3>
          <p dir="auto" className="whitespace-pre-line rounded-xl rounded-ss-sm bg-[#dcf8c6] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#111b21]">{recoveryMessage(s, storeName, tr)}</p>
        </section>
      ) : null}
    </div>
  );
}
