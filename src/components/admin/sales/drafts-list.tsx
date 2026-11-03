"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { convertDraft, deleteDrafts } from "@/app/admin/(panel)/orders/drafts/actions";
import { cx } from "@/lib/format";
import type { Order } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Button, Card, Checkbox, ConfirmButton, EmptyState, Input, LinkButton, PageHeader, ease, egp, table, toast } from "../ui";
import { ThumbStack } from "./bits";
import { fmtDate } from "./meta";

export function DraftsList({ rows }: { rows: Order[] }) {
  const router = useRouter();
  const { t: tr, fmt, isRtl } = useT();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((o) => !t || o.number.toLowerCase().includes(t) || o.customer.name.toLowerCase().includes(t) || o.customer.phone.includes(t));
  }, [rows, q]);
  const allChecked = visible.length > 0 && visible.every((o) => selected.has(o.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const convert = async (o: Order) => {
    setBusy(o.id);
    const res = await convertDraft(o.id);
    setBusy(null);
    if (!res.ok || !res.data) return toast.error(tr("sales.drafts.convertFail"), res.ok ? undefined : res.error);
    toast.success(tr("sales.drafts.created", { number: res.data.number }), tr("sales.drafts.stockUpdated"));
    router.push(`/admin/orders/${res.data.id}`);
  };
  const remove = async (ids: string[]) => {
    const res = await deleteDrafts(ids);
    if (!res.ok) return toast.error(tr("sales.drafts.deleteFail"), res.error);
    toast.success(tr("sales.drafts.deleted", { count: res.data ?? 0 }));
    setSelected(new Set());
    router.refresh();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: tr("sales.order.back") }}
        title={tr("sales.drafts.title")}
        description={tr("sales.drafts.description")}
        actions={
          <LinkButton href="/admin/orders/new" variant="primary" icon="plus">
            {tr("sales.orders.createOrder")}
          </LinkButton>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("sales.drafts.searchPh")} aria-label={tr("sales.drafts.searchAria")} className="ps-9" />
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
            icon="edit"
            title={rows.length ? tr("sales.drafts.emptyFiltered") : tr("sales.drafts.empty")}
            description={rows.length ? tr("sales.drafts.tryAnother") : tr("sales.drafts.emptyDesc")}
            action={!rows.length ? <LinkButton href="/admin/orders/new" variant="primary" icon="plus">{tr("sales.orders.createOrder")}</LinkButton> : undefined}
          />
        ) : (
          <div className={table.wrap}>
            <table className={cx(table.table, "min-w-[760px]")}>
              <thead>
                <tr>
                  <th className={cx(table.th, "w-10 pe-0")}>
                    <Checkbox checked={allChecked} onChange={(v) => setSelected(v ? new Set(visible.map((o) => o.id)) : new Set())} label={<span className="sr-only">{tr("sales.orders.selectAll")}</span>} />
                  </th>
                  <th className={table.th}>{tr("sales.drafts.th.draft")}</th>
                  <th className={table.th}>{tr("sales.drafts.th.updated")}</th>
                  <th className={table.th}>{tr("sales.drafts.th.customer")}</th>
                  <th className={table.th}>{tr("sales.drafts.th.items")}</th>
                  <th className={cx(table.th, "text-end")}>{tr("sales.drafts.th.total")}</th>
                  <th className={cx(table.th, "text-end")}>{tr("sales.drafts.th.actions")}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {visible.map((o, i) => {
                    const updated = o.timeline[o.timeline.length - 1]?.at ?? o.createdAt;
                    return (
                      <motion.tr
                        key={o.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: isRtl ? 12 : -12 }}
                        transition={{ duration: 0.26, ease, delay: Math.min(i, 14) * 0.02 }}
                        className={cx(table.tr, "group cursor-pointer", selected.has(o.id) && "bg-a-violet/[0.06]")}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button,a,input,label")) return;
                          router.push(`/admin/orders/new?draft=${encodeURIComponent(o.id)}`);
                        }}
                      >
                        <td className={cx(table.td, "pe-0")}>
                          <Checkbox checked={selected.has(o.id)} onChange={() => toggle(o.id)} label={<span className="sr-only">{tr("sales.orders.selectOne", { number: o.number })}</span>} />
                        </td>
                        <td className={table.td}>
                          <Link href={`/admin/orders/new?draft=${encodeURIComponent(o.id)}`} className="font-medium tabular-nums hover:text-a-accent" dir="ltr">
                            {o.number}
                          </Link>
                        </td>
                        <td className={cx(table.td, "whitespace-nowrap text-a-dim")} title={fmtDate(fmt, updated)} suppressHydrationWarning>
                          {fmt.ago(updated)}
                        </td>
                        <td className={table.td}>
                          <div className="max-w-[180px] truncate font-medium">{o.customer.name || <span className="text-a-faint">{tr("sales.drafts.noCustomer")}</span>}</div>
                          <div className="text-[12px] tabular-nums text-a-faint"><bdi dir="ltr">{o.customer.phone}</bdi></div>
                        </td>
                        <td className={table.td}>
                          <ThumbStack lines={o.lines} />
                        </td>
                        <td className={cx(table.td, "text-end font-medium tabular-nums")}><bdi dir="ltr">{egp(o.totals.total)}</bdi></td>
                        <td className={cx(table.td, "text-end")}>
                          <Button size="sm" variant="outline" icon="check" loading={busy === o.id} onClick={() => convert(o)}>
                            {tr("sales.orders.createOrder")}
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
