"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { addOrderNote, setOrderStatus, setOrderTags, setPaymentStatus, updateOrderDetails, type OrderDetailsInput } from "@/app/admin/(panel)/orders/actions";
import { cx } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Badge, Button, Card, ConfirmButton, Field, IconBtn, Input, LinkButton, Modal, PageHeader, Select, Stagger, StaggerItem, Tabs, Textarea, ease, egp, toast } from "../ui";
import { DemoBadge, PaymentBadge, PaymentMethod, StatusBadge, Thumb, copyText } from "./bits";
import { FLOW, NEXT_STEP, STATUS_META, canCancel, canReturn, firstName, fmtDate, isFinal, waNumber } from "./meta";
import { RequestPromptModal, useReviewRequest } from "./review-request";

export interface OrderReviewInfo {
  /** reviews received from this order's review links */
  received: number;
  /** open the WhatsApp prompt right after marking delivered */
  prompt: boolean;
}

export function OrderDetail({ order: o, pastOrders, storeName, governorates, multiBuy, review }: { order: Order; pastOrders: number; storeName: string; governorates: string[]; /** live multi-buy offer, for the totals label */ multiBuy?: { qty: number; pct: number } | null; review: OrderReviewInfo }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const reviewReq = useReviewRequest();

  const run = async (key: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, after?: () => void) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok) return toast.error(t("common.errors.generic"), res.error);
    toast.success(success);
    after?.();
    router.refresh();
  };

  const next = NEXT_STEP[o.status];
  const phoneDigits = o.customer.phone.replace(/\D/g, "");
  const waText = useMemo(() => {
    const vars = { name: firstName(o.customer.name), store: storeName, number: o.number, items: t("sales.order.itemsCount", { count: o.totals.itemCount }), total: egp(o.totals.total), city: o.address.city, governorate: o.address.governorate, status: t(`sales.status.${o.status}`) };
    return o.status === "pending" ? t("sales.order.wa.pending", vars) : t("sales.order.wa.update", vars);
  }, [o, storeName, t]);
  const waHref = `https://wa.me/${waNumber(o.customer.phone)}?text=${encodeURIComponent(waText)}`;

  const addressText = [o.customer.name, o.customer.phone, `${o.address.street}, ${o.address.building}`, o.address.landmark, `${o.address.city}, ${o.address.governorate}`].filter(Boolean).join("\n");

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: t("sales.order.back") }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums" dir="ltr">{o.number}</span>
            <StatusBadge status={o.status} />
            <PaymentBadge status={o.paymentStatus} />
            {o.demo ? <DemoBadge /> : null}
          </span>
        }
        description={
          <>
            {fmtDate(fmt, o.createdAt)} · {t(`sales.source.${o.source}`)} · {t("sales.order.itemsCount", { count: o.totals.itemCount })}
          </>
        }
        actions={
          <>
            <LinkButton href={`/admin/orders/${o.id}/invoice`} icon="print">
              {t("sales.order.invoice")}
            </LinkButton>
            {next ? (
              <Button variant="primary" icon={next.icon} loading={busy === "next"} onClick={() => run("next", () => setOrderStatus(o.id, next.to), t("sales.order.statusToast", { status: t(`sales.status.${next.to}`) }), next.to === "delivered" && review.prompt ? () => setPrompt(true) : undefined)}>
                {t(`sales.nextStep.${o.status as "pending"}`)}
              </Button>
            ) : null}
          </>
        }
      />

      <Stagger className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <StaggerItem>
            <Stepper order={o} />
          </StaggerItem>

          <StaggerItem>
            <Card title={t("sales.order.items")} description={t("sales.order.linesCount", { count: o.lines.length })} padded={false}>
              <ul className="divide-y divide-a-line/70">
                {o.lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-3.5 px-5 py-3.5">
                    <Thumb src={l.image} alt={l.title} size={56} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/products/${l.productId}`} className="truncate font-medium hover:text-a-accent">
                          {l.title}
                        </Link>
                        {l.free ? <Badge tone="green">{t("sales.order.freeBadge")}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-a-dim">
                        {l.color} · {t("sales.order.size", { size: l.size })}
                      </p>
                      <p className="mt-0.5 text-[12.5px] tabular-nums text-a-faint" dir="ltr">
                        {l.qty} × <span className={l.free ? "line-through" : ""}>{egp(l.unit)}</span>
                      </p>
                    </div>
                    <span className={cx("shrink-0 font-medium tabular-nums", l.free ? "text-a-ok" : null)}>{l.free && !l.total ? t("sales.order.free") : <bdi dir="ltr">{egp(l.total)}</bdi>}</span>
                  </li>
                ))}
              </ul>
              <Totals order={o} multiBuy={multiBuy} />
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Timeline order={o} onAdded={() => router.refresh()} />
          </StaggerItem>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <StaggerItem>
            <Card title={t("sales.order.customer")} actions={<IconBtn icon="edit" label={t("sales.order.editCustomer")} onClick={() => setEditOpen(true)} />}>
              <p className="font-medium">{o.customer.name}</p>
              <Link href={`/admin/customers/${phoneDigits}`} className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-a-accent hover:underline">
                {t("sales.order.ordersTotal", { count: pastOrders })} <AIcon name="chevronRight" size={13} className="rtl:-scale-x-100" />
              </Link>
              <div className="mt-4 space-y-2 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 tabular-nums text-a-dim">
                    <AIcon name="phone" size={15} className="text-a-faint" />
                    <bdi dir="ltr">{o.customer.phone}</bdi>
                  </span>
                  <IconBtn icon="copy" label={t("sales.order.copyPhone")} onClick={() => copyText(o.customer.phone, toast.success, t("sales.order.phoneCopied"))} />
                </div>
                {o.customer.email ? (
                  <a href={`mailto:${o.customer.email}`} className="flex items-center gap-2 truncate text-a-dim hover:text-a-text">
                    <AIcon name="mail" size={15} className="text-a-faint" />
                    <bdi dir="ltr">{o.customer.email}</bdi>
                  </a>
                ) : null}
                {o.customer.whatsappUpdates ? <p className="text-[12px] text-a-faint">{t("sales.order.waOptIn")}</p> : null}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <LinkButton href={`tel:${o.customer.phone}`} icon="phone" size="sm" external>
                  {t("sales.order.call")}
                </LinkButton>
                <LinkButton href={waHref} icon="whatsapp" size="sm" external className="!bg-[#25d366]/12 !text-[#4ae38b] a-light:!text-[#15803d] !ring-[#25d366]/25 hover:!bg-[#25d366]/20">
                  WhatsApp
                </LinkButton>
              </div>
              <div className="mt-3 border-t border-a-line pt-3">
                <Button
                  size="sm"
                  icon="reviews"
                  className="w-full"
                  disabled={o.status !== "delivered"}
                  loading={reviewReq.busy === o.id}
                  onClick={() => reviewReq.send(o.id)}
                  aria-describedby={`rr-${o.id}`}
                >
                  {o.reviewRequestedAt ? t("reviews.request.again") : t("reviews.request.button")}
                </Button>
                <p id={`rr-${o.id}`} className="mt-1.5 text-center text-[12px] text-a-faint">
                  {o.status !== "delivered"
                    ? t("reviews.request.onlyDelivered")
                    : o.reviewRequestedAt
                      ? `${t(o.reviewRequestSentAt ? "reviews.request.requestedSent" : "reviews.request.requested", { ago: fmt.ago(o.reviewRequestedAt) })}${review.received ? ` · ${t("reviews.request.received", { count: review.received })}` : ""}`
                      : review.received
                        ? t("reviews.request.received", { count: review.received })
                        : null}
                </p>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card
              title={t("sales.order.shippingAddress")}
              actions={
                <>
                  <IconBtn icon="copy" label={t("sales.order.copyAddress")} onClick={() => copyText(addressText, toast.success, t("sales.order.addressCopied"))} />
                  <IconBtn icon="edit" label={t("sales.order.editAddress")} onClick={() => setEditOpen(true)} />
                </>
              }
            >
              <address className="text-[13px] not-italic leading-relaxed text-a-dim">
                {o.address.street}
                <br />
                {o.address.building}
                {o.address.landmark ? (
                  <>
                    <br />
                    {t("sales.order.near", { landmark: o.address.landmark })}
                  </>
                ) : null}
                <br />
                <span className="text-a-text">
                  {o.address.city}, {o.address.governorate}
                </span>
              </address>
              {o.address.notes ? <p className="mt-3 rounded-lg bg-a-panel-2 p-2.5 text-[12.5px] text-a-dim">“{o.address.notes}”</p> : null}
              <div className="mt-4 flex items-center justify-between border-t border-a-line pt-3 text-[13px]">
                <span className="flex items-center gap-2 text-a-dim">
                  <AIcon name="truck" size={15} className="text-a-faint" /> {t("sales.order.delivery")}
                </span>
                <Badge tone={o.shipping === "express" ? "pink" : "neutral"}>{t(`sales.shipping.${o.shipping}`)}</Badge>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <TagsCard order={o} onSaved={() => router.refresh()} />
          </StaggerItem>

          <StaggerItem>
            <Card title={t("sales.order.paymentActions")}>
              <div className="flex items-center justify-between text-[13px]">
                <PaymentMethod method={o.paymentMethod} />
                <PaymentBadge status={o.paymentStatus} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {o.paymentStatus === "unpaid" && !isFinal(o.status) ? (
                  <Button size="sm" icon="cash" loading={busy === "paid"} onClick={() => run("paid", () => setPaymentStatus(o.id, "paid"), t("sales.order.markedPaid"))}>
                    {t("sales.order.markPaid")}
                  </Button>
                ) : null}
                {o.paymentStatus === "paid" ? (
                  <ConfirmButton icon="refresh" variant="secondary" confirmLabel={t("sales.order.confirmRefund")} onConfirm={() => run("refund", () => setPaymentStatus(o.id, "refunded"), t("sales.order.refunded"))}>
                    {t("sales.order.refund")}
                  </ConfirmButton>
                ) : null}
                {canReturn(o.status) ? (
                  <ConfirmButton icon="refresh" variant="secondary" confirmLabel={t("sales.order.confirmReturn")} onConfirm={() => run("return", () => setOrderStatus(o.id, "returned"), t("sales.order.returnedToast"))}>
                    {t("sales.order.markReturned")}
                  </ConfirmButton>
                ) : null}
                {canCancel(o.status) ? (
                  <ConfirmButton icon="close" confirmLabel={t("sales.order.confirmCancel")} onConfirm={() => run("cancel", () => setOrderStatus(o.id, "cancelled"), t("sales.order.cancelledToast"))}>
                    {t("sales.order.cancelOrder")}
                  </ConfirmButton>
                ) : null}
              </div>
              {canCancel(o.status) || canReturn(o.status) ? <p className="mt-3 text-[12px] text-a-faint">{t("sales.order.restockHint")}</p> : null}
            </Card>
          </StaggerItem>
        </div>
      </Stagger>

      <EditDetails open={editOpen} onClose={() => setEditOpen(false)} order={o} governorates={governorates} onSaved={() => router.refresh()} />
      <RequestPromptModal open={prompt} onClose={() => setPrompt(false)} orderId={o.id} name={firstName(o.customer.name)} />
    </>
  );
}

/* ───────────── Stepper ───────────── */

function Stepper({ order: o }: { order: Order }) {
  const { t, fmt } = useT();
  const lastAt = (s: OrderStatus) => [...o.timeline].reverse().find((t) => t.status === s)?.at;
  const reached = o.status === "cancelled" ? Math.max(0, ...FLOW.map((s, i) => (lastAt(s) ? i : 0))) : o.status === "returned" ? FLOW.length - 1 : FLOW.indexOf(o.status);
  const final = isFinal(o.status);
  return (
    <Card padded={false} className="px-5 py-5">
      <AnimatePresence>
        {final ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-5">
            <div className={cx("flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] ring-1 ring-inset", o.status === "cancelled" ? "bg-a-danger/10 text-a-danger ring-a-danger/20" : "bg-a-ink/[0.04] text-a-dim ring-a-line")}>
              <AIcon name={STATUS_META[o.status].icon} size={16} />
              <span>{t("sales.order.finalNotice", { status: t(`sales.status.${o.status}`), when: lastAt(o.status) ? ` · ${fmt.ago(lastAt(o.status)!)}` : "" })}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <ol className="relative grid grid-cols-5">
        <div className="absolute start-[10%] end-[10%] top-[15px] h-[2px] rounded-full bg-a-ink/[0.08]" aria-hidden>
          <motion.div className={cx("h-full rounded-full", final ? "bg-a-ink/25" : "a-grad")} initial={{ width: 0 }} animate={{ width: `${(reached / (FLOW.length - 1)) * 100}%` }} transition={{ duration: 0.7, ease }} />
        </div>
        {FLOW.map((s, i) => {
          const done = i <= reached;
          const current = i === reached && !final && s !== "delivered";
          const at = lastAt(s);
          return (
            <li key={s} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
              <motion.span
                initial={false}
                animate={{ scale: current ? 1.08 : 1 }}
                className={cx("relative z-[1] grid size-[32px] place-items-center rounded-full ring-4 ring-a-panel transition-colors duration-300", done ? (final ? "bg-a-ink/20 text-a-text" : "a-grad text-white") : "bg-a-panel-2 text-a-faint ring-a-panel")}
              >
                {current ? <span className="absolute inset-0 animate-ping rounded-full bg-a-violet/30" /> : null}
                <AIcon name={done && !current ? "check" : STATUS_META[s].icon} size={15} strokeWidth={done ? 2.2 : 1.6} />
              </motion.span>
              <span className={cx("mt-2 text-[12.5px] font-medium", done ? "text-a-text" : "text-a-faint")}>{t(`sales.status.${s}`)}</span>
              <span className="mt-0.5 hidden text-[11.5px] text-a-faint sm:block">{at && done ? fmt.ago(at) : "—"}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ───────────── Totals ───────────── */

function Totals({ order: o, multiBuy }: { order: Order; multiBuy?: { qty: number; pct: number } | null }) {
  const { t: tr } = useT();
  const t = o.totals;
  const shipLabel = tr("sales.order.totals.shipping", { type: tr(`sales.shipping.${o.shipping}`) });
  const rows: [string, number, string?][] = [
    [tr("sales.order.totals.subtotal"), t.subtotal],
    ...(t.bogoDiscount ? [[tr("sales.order.totals.bogo"), -t.bogoDiscount, "text-a-ok"] as [string, number, string]] : []),
    ...(t.multiDiscount ? [[multiBuy ? tr("sales.order.totals.multiN", multiBuy) : tr("sales.order.totals.multi"), -t.multiDiscount, "text-a-ok"] as [string, number, string]] : []),
    ...(t.promoDiscount ? [[`${tr("sales.order.totals.promo")}${o.promoCode ? ` · ${o.promoCode}` : ""}`, -t.promoDiscount, "text-a-ok"] as [string, number, string]] : []),
    ...(t.prepaidDiscount ? [[tr("sales.order.totals.prepaid"), -t.prepaidDiscount, "text-a-ok"] as [string, number, string]] : []),
    [shipLabel, t.shipping],
    ...(t.protection ? [[tr("sales.order.totals.protection"), t.protection] as [string, number]] : []),
    ...(t.bump ? [[tr("sales.order.totals.bump"), t.bump] as [string, number]] : []),
  ];
  return (
    <dl className="space-y-2 border-t border-a-line bg-a-ink/[0.015] px-5 py-4 text-[13px]">
      {rows.map(([label, v, tone]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-a-dim">{label}</dt>
          <dd className={cx("tabular-nums", tone)}>{label === shipLabel && v === 0 ? tr("sales.order.free") : <bdi dir="ltr">{v < 0 ? `− ${egp(-v)}` : egp(v)}</bdi>}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-a-line pt-3 text-[15px] font-semibold">
        <dt>{tr("sales.order.totals.total")}</dt>
        <dd className="tabular-nums"><bdi dir="ltr">{egp(t.total)}</bdi></dd>
      </div>
    </dl>
  );
}

/* ───────────── Timeline ───────────── */

function Timeline({ order: o, onAdded }: { order: Order; onAdded: () => void }) {
  const { t: tr, fmt } = useT();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const events = useMemo(() => [...o.timeline].map((t, i) => ({ ...t, i })).sort((a, b) => b.at.localeCompare(a.at) || b.i - a.i), [o.timeline]);
  const add = async () => {
    if (!note.trim()) return;
    setSaving(true);
    const res = await addOrderNote(o.id, note);
    setSaving(false);
    if (!res.ok) return toast.error(tr("sales.order.timeline.noteFail"), res.error);
    setNote("");
    toast.success(tr("sales.order.timeline.noteAdded"));
    onAdded();
  };
  return (
    <Card title={tr("sales.order.timeline.title")} description={tr("sales.order.timeline.description")}>
      <div className="mb-5 rounded-xl border border-a-line bg-a-panel-2/60 p-2 has-[textarea:focus]:border-a-violet/50">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
          }}
          placeholder={tr("sales.order.timeline.notePh")}
          aria-label={tr("sales.order.timeline.noteAria")}
          className="min-h-[64px] border-0 bg-transparent focus:ring-0"
        />
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-[11.5px] text-a-faint">{tr("sales.order.timeline.hint")}</span>
          <Button size="sm" variant="primary" disabled={!note.trim()} loading={saving} onClick={add}>
            {tr("sales.order.timeline.addNote")}
          </Button>
        </div>
      </div>
      <ol className="relative space-y-4 ps-6">
        <span className="absolute bottom-2 start-[7px] top-2 w-px bg-a-line" aria-hidden />
        <AnimatePresence initial={false}>
          {events.map((t) => {
            const isNote = t.status === "note";

            return (
              <motion.li key={`${t.at}-${t.i}`} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="relative">
                <span className={cx("absolute -start-6 top-1 grid size-[15px] place-items-center rounded-full ring-4 ring-a-panel", isNote ? "bg-a-panel-2 ring-a-panel" : "a-grad")}>
                  {isNote ? <span className="size-1.5 rounded-full bg-a-dim" /> : null}
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[13px] font-medium">{isNote ? tr("sales.order.timeline.note") : tr("sales.order.timeline.event", { status: tr(`sales.status.${t.status as OrderStatus}`) })}</p>
                  <time className="text-[11.5px] text-a-faint" dateTime={t.at} title={fmtDate(fmt, t.at)}>
                    {fmt.ago(t.at)}
                    {t.by ? ` · ${t.by === "admin" ? tr("common.admin") : t.by}` : ""}
                  </time>
                </div>
                {t.note ? <p className={cx("mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-a-dim", isNote && "rounded-lg bg-a-panel-2 px-3 py-2")}>{sysNote(t.note, tr)}</p> : null}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </Card>
  );
}

/* ───────────── Tags ───────────── */

function TagsCard({ order: o, onSaved }: { order: Order; onSaved: () => void }) {
  const { t: tr } = useT();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const tags = o.tags ?? [];
  const save = async (next: string[]) => {
    setSaving(true);
    const res = await setOrderTags(o.id, next);
    setSaving(false);
    if (!res.ok) return toast.error(tr("sales.order.tags.saveFail"), res.error);
    setText("");
    onSaved();
  };
  return (
    <Card title={tr("sales.order.tags.title")}>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {tags.map((t) => (
            <motion.span key={t} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="inline-flex h-7 items-center gap-1 rounded-full bg-a-violet/12 ps-2.5 pe-1 text-[12px] text-a-accent ring-1 ring-inset ring-a-violet/25">
              {t}
              <button type="button" aria-label={tr("sales.order.tags.remove", { tag: t })} disabled={saving} onClick={() => save(tags.filter((x) => x !== t))} className="grid size-5 place-items-center rounded-full hover:bg-a-ink/10">
                <AIcon name="close" size={11} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        {!tags.length ? <span className="text-[12.5px] text-a-faint">{tr("sales.order.tags.empty")}</span> : null}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) save([...tags, ...text.split(",")]);
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("sales.order.tags.add")} aria-label={tr("sales.order.tags.add")} />
        <Button type="submit" size="md" icon="plus" loading={saving} disabled={!text.trim()} aria-label={tr("sales.order.tags.add")} />
      </form>
    </Card>
  );
}

/* ───────────── Edit modal ───────────── */

function EditDetails({ open, onClose, order: o, governorates, onSaved }: { open: boolean; onClose: () => void; order: Order; governorates: string[]; onSaved: () => void }) {
  const { t } = useT();
  const initial = (): OrderDetailsInput => ({ customer: { ...o.customer }, address: { ...o.address }, shipping: o.shipping });
  const [form, setForm] = useState<OrderDetailsInput>(initial);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) setForm(initial());
  }
  const c = (k: keyof Order["customer"], v: string) => setForm((f) => ({ ...f, customer: { ...f.customer, [k]: v } }));
  const a = (k: keyof Order["address"], v: string) => setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));
  const govs = governorates.includes(o.address.governorate) ? governorates : [o.address.governorate, ...governorates];
  const save = async () => {
    setSaving(true);
    const res = await updateOrderDetails(o.id, form);
    setSaving(false);
    if (!res.ok) return toast.error(t("common.errors.saveFailed"), res.error);
    toast.success(t("sales.order.edit.saved"));
    onClose();
    onSaved();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("sales.order.edit.title")}
      description={t("sales.order.edit.description", { number: o.number })}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {t("common.saveChanges")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("sales.order.edit.name")} htmlFor="ed-name">
          <Input id="ed-name" value={form.customer.name} onChange={(e) => c("name", e.target.value)} />
        </Field>
        <Field label={t("sales.order.edit.phone")} htmlFor="ed-phone">
          <Input id="ed-phone" dir="ltr" inputMode="tel" value={form.customer.phone} onChange={(e) => c("phone", e.target.value)} />
        </Field>
        <Field label={t("sales.order.edit.email")} htmlFor="ed-email" className="sm:col-span-2">
          <Input id="ed-email" type="email" value={form.customer.email ?? ""} onChange={(e) => c("email", e.target.value)} placeholder={t("common.optional")} />
        </Field>
        <Field label={t("sales.order.edit.governorate")} htmlFor="ed-gov">
          <Select id="ed-gov" value={form.address.governorate} onChange={(e) => a("governorate", e.target.value)}>
            {govs.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("sales.order.edit.city")} htmlFor="ed-city">
          <Input id="ed-city" value={form.address.city} onChange={(e) => a("city", e.target.value)} />
        </Field>
        <Field label={t("sales.order.edit.street")} htmlFor="ed-street" className="sm:col-span-2">
          <Input id="ed-street" value={form.address.street} onChange={(e) => a("street", e.target.value)} />
        </Field>
        <Field label={t("sales.order.edit.building")} htmlFor="ed-bldg">
          <Input id="ed-bldg" value={form.address.building} onChange={(e) => a("building", e.target.value)} />
        </Field>
        <Field label={t("sales.order.edit.landmark")} htmlFor="ed-landmark">
          <Input id="ed-landmark" value={form.address.landmark ?? ""} onChange={(e) => a("landmark", e.target.value)} placeholder={t("common.optional")} />
        </Field>
        <Field label={t("sales.order.edit.notes")} htmlFor="ed-notes" className="sm:col-span-2">
          <Textarea id="ed-notes" value={form.address.notes ?? ""} onChange={(e) => a("notes", e.target.value)} className="min-h-[64px]" />
        </Field>
        <Field label={t("sales.order.edit.deliveryType")} className="sm:col-span-2">
          <Tabs<Order["shipping"]> value={form.shipping} onChange={(v) => setForm((f) => ({ ...f, shipping: v }))} items={[{ value: "standard", label: t("sales.shipping.standard") }, { value: "express", label: t("sales.shipping.express") }]} />
        </Field>
      </div>
    </Modal>
  );
}

/** Translate the system notes the server writes into the timeline (merchant notes pass through). */
function sysNote(note: string, tr: ReturnType<typeof useT>["t"]) {
  let m: RegExpMatchArray | null;
  if ((m = note.match(/^Payment marked (unpaid|paid|refunded)$/))) return tr("sales.order.timeline.sys.paymentMarked", { status: tr(`sales.payment.${m[1] as "paid"}`) });
  if (note === "Customer / shipping details edited") return tr("sales.order.timeline.sys.detailsEdited");
  if (note === "Draft edited") return tr("sales.order.timeline.sys.draftEdited");
  if (note === "Created in admin") return tr("sales.order.timeline.sys.createdInAdmin");
  if ((m = note.match(/^Created from draft (\S+)$/))) return tr("sales.order.timeline.sys.fromDraft", { number: m[1] });
  return note;
}
