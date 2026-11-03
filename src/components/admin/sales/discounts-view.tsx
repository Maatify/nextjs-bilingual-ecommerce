"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { deletePromoCode, saveOffer, savePromoCode, saveReviewReward, togglePromoCode } from "@/app/admin/(panel)/discounts/actions";
import { cx } from "@/lib/format";
import type { OfferSettings, PromoCode, ReviewSettings } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Badge, Button, Card, ConfirmButton, Drawer, EmptyState, Field, IconBtn, Input, PageHeader, SaveBar, Select, Switch, Tabs, ease, egp, table, toast, useDraft, type Tone } from "../ui";
import { copyText } from "./bits";

const CODE_RE = /^[A-Z0-9_-]{3,24}$/;
const WORDS = ["VERDA", "STYLE", "FRESH", "DROP", "EDIT", "LOOK", "FIT", "NEW"];

function generateCode() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += chars[Math.floor(Math.random() * chars.length)];
  return `${w}-${tail}`;
}

type CodeState = "paused" | "usedUp" | "scheduled" | "expired" | "active";
function codeState(p: PromoCode, today: string): { label: CodeState; tone: Tone } {
  if (!p.active) return { label: "paused", tone: "neutral" };
  if (p.usageLimit && (p.used ?? 0) >= p.usageLimit) return { label: "usedUp", tone: "amber" };
  if (p.startsAt && p.startsAt.slice(0, 10) > today) return { label: "scheduled", tone: "blue" };
  if (p.endsAt && p.endsAt.slice(0, 10) < today) return { label: "expired", tone: "red" };
  return { label: "active", tone: "green" };
}

/** "12 Mar" in the admin locale (noon UTC so the Cairo date never shifts). */
const shortDay = (fmt: { date: (d: string, o?: Intl.DateTimeFormatOptions) => string }, d?: string) => (d ? fmt.date(`${d.slice(0, 10)}T12:00:00Z`, { day: "numeric", month: "short" }) : "");

export function DiscountsView({ promoCodes, offer, samplePrice, today, reviewReward }: { promoCodes: PromoCode[]; offer: OfferSettings; samplePrice: number; today: string; reviewReward: ReviewSettings["reward"] }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ original?: string; value: PromoCode } | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toUpperCase();
    return s ? promoCodes.filter((p) => p.code.includes(s) || p.label.toUpperCase().includes(s)) : promoCodes;
  }, [promoCodes, q]);

  const toggle = async (p: PromoCode, active: boolean) => {
    setToggling(p.code);
    const res = await togglePromoCode(p.code, active);
    setToggling(null);
    if (!res.ok) return toast.error(t("sales.discounts.updateFail"), res.error);
    toast.success(active ? t("sales.discounts.live", { code: p.code }) : t("sales.discounts.pausedToast", { code: p.code }));
    router.refresh();
  };
  const remove = async (code: string) => {
    const res = await deletePromoCode(code);
    if (!res.ok) return toast.error(t("sales.drafts.deleteFail"), res.error);
    toast.success(t("sales.discounts.deleted", { code }));
    router.refresh();
  };
  const newCode = (init?: Partial<PromoCode>) => setEditing({ value: { code: "", label: "", pct: 10, active: true, used: 0, ...init } });

  return (
    <>
      <PageHeader
        title={t("sales.discounts.title")}
        description={t("sales.discounts.description")}
        actions={
          <Button variant="primary" icon="plus" onClick={() => newCode()}>
            {t("sales.discounts.newCode")}
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <Card
          padded={false}
          title={t("sales.discounts.codes")}
          description={t("sales.discounts.codesDesc", { live: promoCodes.filter((p) => codeState(p, today).label === "active").length, total: promoCodes.length })}
          actions={
            <div className="relative w-44 sm:w-56">
              <AIcon name="search" size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-a-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sales.discounts.searchPh")} aria-label={t("sales.discounts.searchAria")} className="h-8 ps-8 text-[13px]" />
            </div>
          }
        >
          {list.length ? (
            <div className={table.wrap}>
              <table className={cx(table.table, "min-w-[860px]")}>
                <thead>
                  <tr>
                    <th className={table.th}>{t("sales.discounts.th.code")}</th>
                    <th className={table.th}>{t("sales.discounts.th.discount")}</th>
                    <th className={table.th}>{t("sales.discounts.th.usage")}</th>
                    <th className={table.th}>{t("sales.discounts.th.schedule")}</th>
                    <th className={table.th}>{t("sales.discounts.th.status")}</th>
                    <th className={table.th}>{t("sales.discounts.th.active")}</th>
                    <th className={cx(table.th, "text-end")}>
                      <span className="sr-only">{t("common.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {list.map((p) => {
                      const st = codeState(p, today);
                      const pct = p.usageLimit ? Math.min(100, ((p.used ?? 0) / p.usageLimit) * 100) : 0;
                      return (
                        <motion.tr key={p.code} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }} className={table.tr}>
                          <td className={table.td}>
                            <div className="flex items-center gap-1.5">
                              <button dir="ltr" lang="en" onClick={() => copyText(p.code, toast.success, t("sales.discounts.copied", { code: p.code }))} className="rounded-md border border-dashed border-a-line-strong bg-a-panel-2 px-2 py-0.5 font-mono text-[12.5px] font-medium tracking-wide transition hover:border-a-violet/60" title={t("sales.discounts.copyCode")}>
                                {p.code}
                              </button>
                            </div>
                            <p className="mt-1 max-w-[220px] truncate text-[12px] text-a-faint">{p.label}</p>
                          </td>
                          <td className={table.td}>
                            <span className="font-medium">{p.pct ? t("sales.draft.pctOff", { pct: p.pct }) : t("sales.discounts.amountOff", { amount: egp(p.amount ?? 0) })}</span>
                            <p className="text-[12px] text-a-faint">{p.minSubtotal ? t("sales.discounts.over", { amount: egp(p.minSubtotal) }) : t("sales.discounts.noMin")}</p>
                          </td>
                          <td className={cx(table.td, "w-40")}>
                            <span className="tabular-nums" dir="ltr">
                              {p.used ?? 0}
                              <span className="text-a-faint"> / {p.usageLimit ?? "∞"}</span>
                            </span>
                            {p.usageLimit ? (
                              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-a-ink/[0.06]">
                                <motion.span className={cx("block h-full rounded-full", pct >= 80 ? "bg-a-warn" : "a-grad")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease }} />
                              </span>
                            ) : null}
                          </td>
                          <td className={cx(table.td, "whitespace-nowrap text-a-dim")}>{p.startsAt || p.endsAt ? t("sales.discounts.range", { from: p.startsAt ? shortDay(fmt, p.startsAt) : t("sales.discounts.now"), to: p.endsAt ? shortDay(fmt, p.endsAt) : t("sales.discounts.noEnd") }) : t("sales.discounts.always")}</td>
                          <td className={table.td}>
                            <Badge tone={st.tone} dot>
                              {t(`sales.discounts.state.${st.label}`)}
                            </Badge>
                          </td>
                          <td className={table.td}>
                            <Switch checked={p.active} disabled={toggling === p.code} onChange={(v) => toggle(p, v)} />
                          </td>
                          <td className={cx(table.td, "text-end")}>
                            <div className="flex items-center justify-end gap-1">
                              <IconBtn icon="edit" label={t("sales.discounts.editCode", { code: p.code })} onClick={() => setEditing({ original: p.code, value: { ...p } })} />
                              <ConfirmButton size="xs" confirmLabel={t("sales.discounts.deleteQ")} onConfirm={() => remove(p.code)}>
                                <span className="sr-only">{t("sales.discounts.deleteCode", { code: p.code })}</span>
                              </ConfirmButton>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="discount" title={q ? t("sales.discounts.noMatch") : t("sales.discounts.empty")} description={q ? t("sales.discounts.tryAnother") : t("sales.discounts.emptyDesc")} action={!q ? <Button icon="plus" onClick={() => newCode()}>{t("sales.discounts.newCode")}</Button> : null} />
          )}
        </Card>

        <OffersCard offer={offer} samplePrice={samplePrice} promoCodes={promoCodes} onCreateWelcome={(code, pct) => newCode({ code, pct, label: `${pct}% off your first order` })} />
        <ReviewRewardCard reward={reviewReward} />
      </div>

      <PromoDrawer editing={editing} onClose={() => setEditing(null)} existing={promoCodes.map((p) => p.code)} onSaved={() => (setEditing(null), router.refresh())} />
    </>
  );
}

/* ───────────── Promo code drawer ───────────── */

function PromoDrawer({ editing, onClose, existing, onSaved }: { editing: { original?: string; value: PromoCode } | null; onClose: () => void; existing: string[]; onSaved: () => void }) {
  const { t } = useT();
  const [v, setV] = useState<PromoCode | null>(null);
  const [src, setSrc] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  if (src !== editing) {
    setSrc(editing);
    setV(editing ? { ...editing.value } : null);
    setTouched(false);
  }
  const kind = v?.amount && !v.pct ? "amount" : "pct";
  const set = (patch: Partial<PromoCode>) => setV((x) => (x ? { ...x, ...patch } : x));

  const errors = useMemo(() => {
    if (!v) return {};
    const e: Record<string, string> = {};
    if (!CODE_RE.test(v.code)) e.code = t("sales.discounts.err.code");
    else if (existing.some((c) => c === v.code && c !== editing?.original)) e.code = t("sales.discounts.err.exists", { code: v.code });
    if (kind === "pct" && !(v.pct && v.pct >= 1 && v.pct <= 90)) e.value = t("sales.discounts.err.pct");
    if (kind === "amount" && !(v.amount && v.amount > 0)) e.value = t("sales.discounts.err.amount");
    if (v.startsAt && v.endsAt && v.endsAt.slice(0, 10) < v.startsAt.slice(0, 10)) e.endsAt = t("sales.discounts.err.ends");
    if (v.usageLimit !== undefined && v.usageLimit < 1) e.usageLimit = t("sales.discounts.err.limit");
    return e;
  }, [v, existing, editing?.original, kind, t]);
  const valid = Object.keys(errors).length === 0;

  const save = async () => {
    setTouched(true);
    if (!v || !valid) return;
    setSaving(true);
    const res = await savePromoCode(v, editing?.original);
    setSaving(false);
    if (!res.ok) return toast.error(t("sales.discounts.saveFail"), res.error);
    toast.success(editing?.original ? t("sales.discounts.updated", { code: v.code }) : t("sales.discounts.created", { code: v.code }), t("sales.discounts.liveNow"));
    onSaved();
  };
  const numOrUndef = (s: string) => (s === "" ? undefined : Math.max(0, Number(s)));

  return (
    <Drawer
      open={!!editing}
      onClose={onClose}
      title={editing?.original ? t("sales.discounts.editCode", { code: editing.original }) : t("sales.discounts.newCode")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {editing?.original ? t("sales.discounts.saveCode") : t("sales.discounts.createCode")}
          </Button>
        </>
      }
    >
      {v ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field
            label={t("sales.discounts.f.code")}
            htmlFor="pc-code"
            error={touched || v.code ? errors.code : null}
            hint={t("sales.discounts.f.codeHint")}
            aside={
              <button type="button" onClick={() => set({ code: generateCode() })} className="inline-flex items-center gap-1 text-[12px] font-medium text-a-accent hover:underline">
                <AIcon name="sparkle" size={13} /> {t("sales.discounts.f.generate")}
              </button>
            }
          >
            <Input id="pc-code" value={v.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="SUMMER20" dir="ltr" className="font-mono tracking-wide" autoFocus maxLength={24} />
          </Field>
          <Field label={t("sales.discounts.f.label")} htmlFor="pc-label" hint={t("sales.discounts.f.labelHint")}>
            <Input id="pc-label" value={v.label} onChange={(e) => set({ label: e.target.value })} placeholder={kind === "pct" ? t("sales.draft.pctOff", { pct: v.pct ?? 10 }) : t("sales.discounts.amountOff", { amount: egp(v.amount ?? 0) })} />
          </Field>
          <Field label={t("sales.discounts.th.discount")} error={touched ? errors.value : null}>
            <div className="flex gap-2">
              <Tabs<"pct" | "amount">
                value={kind}
                onChange={(k) => (k === "pct" ? set({ pct: v.pct || 10, amount: undefined }) : set({ amount: v.amount || 100, pct: undefined }))}
                items={[
                  { value: "pct", label: "%" },
                  { value: "amount", label: "EGP" },
                ]}
              />
              {kind === "pct" ? (
                <Input type="number" min={1} max={90} value={v.pct ?? ""} onChange={(e) => set({ pct: numOrUndef(e.target.value) })} suffix="%" aria-label={t("sales.draft.percentOff")} className="flex-1" />
              ) : (
                <Input type="number" min={1} value={v.amount ?? ""} onChange={(e) => set({ amount: numOrUndef(e.target.value) })} prefix="EGP" aria-label={t("sales.draft.amountOff")} className="flex-1" />
              )}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("sales.discounts.f.min")} htmlFor="pc-min" hint={t("sales.discounts.f.minHint")}>
              <Input id="pc-min" type="number" min={0} prefix="EGP" value={v.minSubtotal ?? ""} onChange={(e) => set({ minSubtotal: numOrUndef(e.target.value) })} />
            </Field>
            <Field label={t("sales.discounts.f.limit")} htmlFor="pc-limit" error={errors.usageLimit} hint={t("sales.discounts.f.used", { count: v.used ?? 0 })}>
              <Input id="pc-limit" type="number" min={1} value={v.usageLimit ?? ""} onChange={(e) => set({ usageLimit: numOrUndef(e.target.value) })} placeholder={t("sales.discounts.f.unlimited")} />
            </Field>
            <Field label={t("sales.discounts.f.starts")} htmlFor="pc-start">
              <Input id="pc-start" type="date" value={v.startsAt?.slice(0, 10) ?? ""} onChange={(e) => set({ startsAt: e.target.value || undefined })} />
            </Field>
            <Field label={t("sales.discounts.f.ends")} htmlFor="pc-end" error={errors.endsAt}>
              <Input id="pc-end" type="date" value={v.endsAt?.slice(0, 10) ?? ""} onChange={(e) => set({ endsAt: e.target.value || undefined })} />
            </Field>
          </div>
          <div className="rounded-xl border border-a-line bg-a-panel-2/50 p-4">
            <Switch checked={v.active} onChange={(active) => set({ active })} label={t("sales.discounts.th.active")} description={t("sales.discounts.f.activeHint")} />
          </div>
          <button type="submit" hidden />
        </form>
      ) : null}
    </Drawer>
  );
}

/* ───────────── Automatic offers ───────────── */

function OffersCard({ offer, samplePrice, promoCodes, onCreateWelcome }: { offer: OfferSettings; samplePrice: number; promoCodes: PromoCode[]; onCreateWelcome: (code: string, pct: number) => void }) {
  const router = useRouter();
  const { t } = useT();
  const [draft, setDraft, dirty, reset] = useDraft(offer);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<OfferSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const n = (s: string) => (s === "" ? 0 : Math.max(0, Number(s)));

  const save = async () => {
    setSaving(true);
    const res = await saveOffer(draft);
    setSaving(false);
    if (!res.ok) return toast.error(t("sales.discounts.offersFail"), res.error);
    toast.success(t("sales.discounts.offersSaved"), t("sales.discounts.offersSavedBody"));
    router.refresh();
  };

  const { buy, get } = draft.bogo;
  const mb = draft.multiBuy ?? { enabled: true, qty: 2, pct: 20 };
  const setMulti = (patch: Partial<typeof mb>) => set({ multiBuy: { ...mb, ...patch } });
  const mbQtyErr = mb.enabled && (!Number.isInteger(mb.qty) || mb.qty < 2 || mb.qty > 10) ? t("sales.discounts.err.multiQty") : null;
  const mbPctErr = mb.enabled && (!(mb.pct >= 1) || mb.pct > 90) ? t("sales.discounts.err.multiPct") : null;
  // same rounding as the checkout (per piece): 2 × 1,590 at 20% → 2 × 1,272 = 2,544
  const mbOffEach = Math.round((samplePrice * mb.pct) / 100);
  const mbPays = (samplePrice - mbOffEach) * mb.qty;
  const group = buy + get;
  const payFor = samplePrice * buy;
  const welcome = promoCodes.find((p) => p.code === draft.welcomeCode.toUpperCase());
  const hour12 = (h: number) => `${h % 12 || 12} ${h < 12 ? t("sales.discounts.am") : t("sales.discounts.pm")}`;

  return (
    <>
      <Card title={t("sales.discounts.auto")} description={t("sales.discounts.autoDesc")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel icon="gift" title={t("sales.discounts.bogo")} right={<Switch checked={draft.bogoEnabled} onChange={(bogoEnabled) => set({ bogoEnabled })} />}>
            <div className={cx("grid grid-cols-2 gap-3 transition-opacity", !draft.bogoEnabled && "pointer-events-none opacity-40")}>
              <Field label={t("sales.discounts.buy")} htmlFor="of-buy">
                <Input id="of-buy" type="number" min={1} max={20} value={buy} onChange={(e) => set({ bogo: { buy: Math.max(1, n(e.target.value)), get } })} suffix={t("sales.discounts.itemsUnit")} />
              </Field>
              <Field label={t("sales.discounts.getFree")} htmlFor="of-get">
                <Input id="of-get" type="number" min={1} max={20} value={get} onChange={(e) => set({ bogo: { buy, get: Math.max(1, n(e.target.value)) } })} suffix={t("sales.discounts.itemsUnit")} />
              </Field>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={`${buy}-${get}-${draft.bogoEnabled}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }} className="mt-3 rounded-lg bg-a-violet/[0.08] px-3 py-2.5 text-[12.5px] leading-relaxed text-a-dim">
                {draft.bogoEnabled ? (
                  t("sales.discounts.bogoExample", { group, get, sample: egp(samplePrice), pays: egp(payFor), saves: egp(samplePrice * get), pct: Math.round((get / group) * 100) })
                ) : (
                  t("sales.discounts.bogoOff")
                )}
              </motion.p>
            </AnimatePresence>
          </Panel>

          <Panel icon="discount" title={t("sales.discounts.multi")} right={<Switch checked={mb.enabled} onChange={(enabled) => setMulti({ enabled })} />}>
            <div className={cx("grid grid-cols-2 gap-3 transition-opacity", !mb.enabled && "pointer-events-none opacity-40")}>
              <Field label={t("sales.discounts.multiQty")} htmlFor="of-mqty" error={mbQtyErr}>
                <Input id="of-mqty" type="number" min={2} max={10} value={Number.isFinite(mb.qty) ? mb.qty : ""} onChange={(e) => setMulti({ qty: n(e.target.value) })} suffix={t("sales.discounts.piecesUnit")} aria-invalid={!!mbQtyErr || undefined} />
              </Field>
              <Field label={t("sales.discounts.multiPct")} htmlFor="of-mpct" error={mbPctErr}>
                <Input id="of-mpct" type="number" min={1} max={90} value={Number.isFinite(mb.pct) ? mb.pct : ""} onChange={(e) => setMulti({ pct: n(e.target.value) })} suffix="%" aria-invalid={!!mbPctErr || undefined} />
              </Field>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={`${mb.qty}-${mb.pct}-${mb.enabled}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }} className="mt-3 rounded-lg bg-a-violet/[0.08] px-3 py-2.5 text-[12.5px] leading-relaxed text-a-dim">
                {mb.enabled && !mbQtyErr && !mbPctErr ? t("sales.discounts.multiExample", { qty: mb.qty, sample: egp(samplePrice), pays: egp(mbPays), pct: mb.pct, saves: egp(mbOffEach * mb.qty) }) : mb.enabled ? "—" : t("sales.discounts.multiOff")}
              </motion.p>
            </AnimatePresence>
          </Panel>

          <Panel icon="truck" title={t("sales.discounts.shipGift")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("sales.discounts.freeShipOver")} htmlFor="of-ship" hint={draft.freeShippingAt ? t("sales.discounts.belowRate") : t("sales.discounts.alwaysCharge")}>
                <Input id="of-ship" type="number" min={0} prefix="EGP" value={draft.freeShippingAt} onChange={(e) => set({ freeShippingAt: n(e.target.value) })} />
              </Field>
              <Field label={t("sales.discounts.giftOver")} htmlFor="of-gift" hint={t("sales.discounts.noGift")}>
                <Input id="of-gift" type="number" min={0} prefix="EGP" value={draft.giftAt} onChange={(e) => set({ giftAt: n(e.target.value) })} />
              </Field>
              <Field label={t("sales.discounts.giftName")} htmlFor="of-giftname" className="sm:col-span-2">
                <Input id="of-giftname" value={draft.giftName} onChange={(e) => set({ giftName: e.target.value })} placeholder={t("sales.discounts.giftPh")} disabled={!draft.giftAt} />
              </Field>
            </div>
          </Panel>

          <Panel icon="card" title={t("sales.order.totals.prepaid")}>
            <Field label={t("sales.discounts.prepaidLabel")} htmlFor="of-prepaid" hint={draft.prepaidDiscountPct ? t("sales.discounts.prepaidHint", { pct: draft.prepaidDiscountPct }) : t("sales.discounts.noIncentive")}>
              <Input id="of-prepaid" type="number" min={0} max={50} suffix="%" value={draft.prepaidDiscountPct} onChange={(e) => set({ prepaidDiscountPct: Math.min(50, n(e.target.value)) })} />
            </Field>
          </Panel>

          <Panel icon="sparkle" title={t("sales.discounts.welcome")}>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
              <Field label={t("sales.discounts.f.code")} htmlFor="of-wcode">
                <Input id="of-wcode" dir="ltr" value={draft.welcomeCode} onChange={(e) => set({ welcomeCode: e.target.value.toUpperCase().replace(/\s+/g, "") })} className="font-mono" />
              </Field>
              <Field label={t("sales.discounts.shownAs")} htmlFor="of-wpct">
                <Input id="of-wpct" type="number" min={0} max={90} suffix="%" value={draft.welcomePct} onChange={(e) => set({ welcomePct: Math.min(90, n(e.target.value)) })} />
              </Field>
            </div>
            {draft.welcomeCode && (!welcome || !welcome.active) ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-a-warn/10 px-3 py-2 text-[12.5px] text-a-warn">
                <span>{welcome ? t("sales.discounts.welcomePaused", { code: welcome.code }) : t("sales.discounts.welcomeMissing", { code: draft.welcomeCode })}</span>
                {!welcome ? (
                  <Button size="xs" variant="outline" onClick={() => onCreateWelcome(draft.welcomeCode, draft.welcomePct || 10)}>
                    {t("sales.discounts.createIt")}
                  </Button>
                ) : null}
              </div>
            ) : welcome && welcome.pct && welcome.pct !== draft.welcomePct ? (
              <p className="mt-3 text-[12.5px] text-a-warn">{t("sales.discounts.headsUp", { pct: welcome.pct })}</p>
            ) : null}
          </Panel>

          <Panel icon="bolt" title={t("sales.discounts.sameDay")} className="lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label={t("sales.discounts.cutoff")} htmlFor="of-cutoff" className="sm:w-48">
                <Select id="of-cutoff" value={draft.cutoffHour} onChange={(e) => set({ cutoffHour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hour12(h)}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="pb-2 text-[12.5px] text-a-dim">{t("sales.discounts.cutoffHint", { time: hour12(draft.cutoffHour) })}</p>
            </div>
          </Panel>
        </div>
      </Card>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={reset} />
    </>
  );
}

/* ───────────── Review reward ───────────── */

function ReviewRewardCard({ reward }: { reward: ReviewSettings["reward"] }) {
  const router = useRouter();
  const { t } = useT();
  const [draft, setDraft] = useState(reward);
  const [savedFrom, setSavedFrom] = useState(reward);
  const [saving, setSaving] = useState(false);
  // adopt fresh server values after a save (router.refresh) without an effect
  if (savedFrom !== reward) {
    setSavedFrom(reward);
    setDraft(reward);
  }
  const set = (p: Partial<ReviewSettings["reward"]>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(reward);
  const err = draft.kind === "pct" ? (!Number.isInteger(draft.value) || draft.value < 1 || draft.value > 90 ? t("reviews.reward.invalidPct") : null) : !(draft.value >= 1) ? t("reviews.reward.invalidAmount") : null;
  const save = async () => {
    setSaving(true);
    const res = await saveReviewReward(draft);
    setSaving(false);
    if (!res.ok) return toast.error(t("reviews.reward.fail"), res.error);
    toast.success(t("reviews.reward.saved"));
    router.refresh();
  };
  const shown = draft.kind === "pct" ? `${draft.value}%` : egp(draft.value);
  return (
    <Card title={t("reviews.reward.title")} description={t("reviews.reward.description")}>
      <div className="flex flex-col gap-4">
        <Switch checked={draft.enabled} onChange={(enabled) => set({ enabled })} label={t("reviews.reward.enabled")} />
        <div className={cx("grid gap-3 transition-opacity sm:grid-cols-[minmax(0,1fr)_minmax(0,160px)]", !draft.enabled && "pointer-events-none opacity-40")} aria-disabled={!draft.enabled || undefined}>
          <Field label={t("reviews.reward.kind")}>
            <Tabs<"pct" | "amount"> value={draft.kind} onChange={(kind) => set({ kind, value: kind === "pct" ? Math.min(90, draft.value) || 10 : draft.value })} items={[{ value: "pct", label: t("reviews.reward.pct") }, { value: "amount", label: t("reviews.reward.amount") }]} />
          </Field>
          <Field label={t("reviews.reward.value")} htmlFor="rr-value" error={draft.enabled ? err : null}>
            <Input id="rr-value" type="number" min={1} max={draft.kind === "pct" ? 90 : undefined} value={Number.isFinite(draft.value) ? draft.value : ""} onChange={(e) => set({ value: e.target.value === "" ? NaN : Number(e.target.value) })} {...(draft.kind === "pct" ? { suffix: "%" } : { prefix: "EGP" })} aria-invalid={(draft.enabled && !!err) || undefined} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={draft.photoRequired} onChange={(photoRequired) => set({ photoRequired })} label={t("reviews.reward.photoRequired")} description={t("reviews.reward.photoRequiredHint")} />
          </div>
        </div>
        {draft.enabled && !err ? <p className="rounded-lg bg-a-violet/[0.08] px-3 py-2.5 text-[12.5px] leading-relaxed text-a-dim">{t("reviews.reward.example", { reward: shown })}</p> : null}
        <p className="flex gap-2 text-[12.5px] leading-relaxed text-a-faint">
          <AIcon name="info" size={14} className="mt-0.5 shrink-0" />
          {t("reviews.reward.disclosure")}
        </p>
        <div className="flex justify-end gap-2">
          {dirty ? (
            <Button variant="ghost" onClick={() => setDraft(reward)}>
              {t("common.discard")}
            </Button>
          ) : null}
          <Button variant="primary" disabled={!dirty || (draft.enabled && !!err)} loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Panel({ icon, title, right, children, className }: { icon: Parameters<typeof AIcon>[0]["name"]; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-a-line bg-a-panel-2/40 p-4 transition-colors hover:border-a-line-strong", className)}>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[13.5px] font-medium">
          <span className="grid size-7 place-items-center rounded-lg bg-a-violet/15 text-a-accent">
            <AIcon name={icon} size={15} />
          </span>
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}
