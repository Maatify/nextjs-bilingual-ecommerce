"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createOrder, deleteDrafts, saveDraftOrder } from "@/app/admin/(panel)/orders/drafts/actions";
import { cx } from "@/lib/format";
import type { PaymentSettings } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Badge, Button, Card, ConfirmButton, Field, IconBtn, Input, Kbd, PageHeader, Select, Textarea, ease, egp, toast } from "../ui";
import { applyOffers, discountAmount, draftTotals, type DiscountKind, type OfferRules, type DraftInput, type DraftLineInput, type PickerCustomer, type PickerProduct } from "./draft-types";
import { METHOD_META, fmtDate } from "./meta";

type Code = { code: string; label: string; pct?: number; amount?: number; minSubtotal?: number; active: boolean };

const BLANK: DraftInput = {
  lines: [],
  customer: { name: "", phone: "", email: "" },
  address: { governorate: "", city: "", street: "", building: "", landmark: "" },
  shippingFee: NaN,
  discount: { kind: "none" },
  notes: "",
  paymentMethod: "cod",
};

const PHONE_OK = (p: string) => /^01[0125]\d{8}$/.test(p.replace(/\D/g, "").replace(/^20/, "0"));

export function DraftOrderEditor({
  draft,
  initial,
  products,
  customers,
  governorates,
  defaultShipping,
  codes,
  payments,
  offer,
}: {
  draft: { id: string; number: string; createdAt: string } | null;
  initial: DraftInput | null;
  products: PickerProduct[];
  customers: PickerCustomer[];
  governorates: { name: string; rate: number }[];
  defaultShipping: number;
  codes: Code[];
  payments: PaymentSettings;
  /** automatic offers (Buy N Get M, multi-buy %) — applied exactly like the server does */
  offer: OfferRules;
}) {
  const router = useRouter();
  const { t, fmt, isRtl } = useT();
  const [d, setD] = useState<DraftInput>(() => initial ?? BLANK);
  const [saved, setSaved] = useState(() => JSON.stringify(initial ?? BLANK));
  const [shipTouched, setShipTouched] = useState(!!initial);
  const [busy, setBusy] = useState<"draft" | "order" | null>(null);
  const [tried, setTried] = useState(false);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const dirty = JSON.stringify(d) !== saved;

  const gov = governorates.find((g) => g.name === d.address.governorate);
  const shipping = Number.isFinite(d.shippingFee) ? d.shippingFee : (gov?.rate ?? defaultShipping);
  const priced = d.lines.map((l) => {
    const p = byId.get(l.productId);
    const unit = p ? (p.prices[`${l.color}|${l.size}`] ?? p.price) : 0;
    const stock = p ? (p.stock[l.color]?.[l.size] ?? 0) : 0;
    return { ...l, p, unit, stock };
  });
  const offers = applyOffers(priced, offer);
  const merch = priced.reduce((n, l) => n + l.unit * l.qty, 0) - offers.bogo - offers.multi;
  const disc = discountAmount(d.discount, merch, codes);
  const totals = draftTotals(priced, disc.amount, shipping, offers);

  const methods = (Object.keys(METHOD_META) as DraftInput["paymentMethod"][]).filter((m) => payments[m] || m === d.paymentMethod);

  const set = <K extends keyof DraftInput>(k: K, v: DraftInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const setCustomer = (patch: Partial<DraftInput["customer"]>) => setD((x) => ({ ...x, customer: { ...x.customer, ...patch } }));
  const setAddress = (patch: Partial<DraftInput["address"]>) => setD((x) => ({ ...x, address: { ...x.address, ...patch } }));

  const addLine = (l: DraftLineInput) =>
    setD((x) => {
      const hit = x.lines.find((y) => y.productId === l.productId && y.color === l.color && y.size === l.size);
      return { ...x, lines: hit ? x.lines.map((y) => (y === hit ? { ...y, qty: y.qty + l.qty } : y)) : [...x.lines, l] };
    });

  const discError = disc.error ? t(`sales.draft.codeErr.${disc.error}`, { min: egp(disc.min ?? 0) }) : undefined;
  const errors = {
    lines: !d.lines.length ? t("sales.draft.err.lines") : priced.some((l) => l.p?.tracked && l.qty > l.stock) ? t("sales.draft.err.stock") : undefined,
    name: !d.customer.name.trim() ? t("sales.draft.err.name") : undefined,
    phone: !d.customer.phone.trim() ? t("sales.draft.err.phone") : !PHONE_OK(d.customer.phone) ? t("sales.draft.err.phoneInvalid") : undefined,
    governorate: !d.address.governorate ? t("sales.draft.err.governorate") : undefined,
    city: !d.address.city.trim() ? t("sales.draft.err.city") : undefined,
    street: !d.address.street.trim() ? t("sales.draft.err.street") : undefined,
    code: d.discount.kind === "code" ? discError : undefined,
  };
  const orderErrors = Object.values(errors).filter(Boolean);

  const payload = (): DraftInput => ({ ...d, shippingFee: shipping });

  // one submit at a time: a double-click lands before `busy` re-renders the button disabled
  const inflight = useRef(false);
  // idempotency key for "Create order" (kept across retries of this editor session; the server dedupes on it)
  const requestId = useRef("");
  const saveDraft = async () => {
    if (inflight.current) return;
    if (!d.lines.length) return toast.error(t("sales.draft.err.addFirst"));
    if (d.customer.phone.trim() && !PHONE_OK(d.customer.phone)) return toast.error(t("sales.draft.err.checkPhone"));
    inflight.current = true;
    setBusy("draft");
    const res = await saveDraftOrder(payload(), draft?.id).finally(() => (inflight.current = false));
    setBusy(null);
    if (!res.ok || !res.data) return toast.error(t("sales.draft.err.saveFail"), res.ok ? undefined : res.error);
    setSaved(JSON.stringify(d));
    toast.success(draft ? t("sales.draft.draftSaved") : t("sales.draft.draftNumSaved", { number: res.data.number }), t("sales.draft.noEffect"));
    if (!draft) router.replace(`/admin/orders/new?draft=${encodeURIComponent(res.data.id)}`);
    else router.refresh();
  };

  const place = async () => {
    setTried(true);
    if (orderErrors.length) return toast.error(t("sales.draft.err.finish"), orderErrors[0]);
    if (inflight.current) return;
    inflight.current = true;
    requestId.current ||= typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    setBusy("order");
    const res = await createOrder(payload(), draft?.id, requestId.current).finally(() => (inflight.current = false));
    setBusy(null);
    if (!res.ok || !res.data) return toast.error(t("sales.draft.err.createFail"), res.ok ? undefined : res.error);
    setSaved(JSON.stringify(d));
    toast.success(t("sales.draft.orderCreated", { number: res.data.number }), t("sales.draft.orderCreatedBody"));
    router.push(`/admin/orders/${res.data.id}`);
  };

  const removeDraft = async () => {
    if (!draft) return;
    const res = await deleteDrafts([draft.id]);
    if (!res.ok) return toast.error(t("sales.draft.err.deleteFail"), res.error);
    toast.success(t("sales.draft.draftDeleted"));
    router.push("/admin/orders/drafts");
  };

  // ⌘S saves the draft
  const saveRef = useRef(saveDraft);
  useEffect(() => {
    saveRef.current = saveDraft;
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  // warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  return (
    <>
      <PageHeader
        back={{ href: draft ? "/admin/orders/drafts" : "/admin/orders", label: draft ? t("sales.orders.drafts") : t("sales.order.back") }}
        title={
          <span className="flex items-center gap-3">
            {draft ? t("sales.draft.titleDraft", { number: draft.number }) : t("sales.draft.metaTitle")}
            {draft ? <Badge tone="neutral">{t("sales.status.draft")}</Badge> : null}
          </span>
        }
        description={draft ? t("sales.draft.started", { date: fmtDate(fmt, draft.createdAt) }) : t("sales.draft.newDesc")}
        actions={
          <>
            {dirty ? <span className="hidden items-center gap-1 text-[12px] text-a-faint sm:flex"><Kbd>⌘</Kbd><Kbd>S</Kbd> {t("sales.draft.kbdSave")}</span> : null}
            <Button onClick={saveDraft} loading={busy === "draft"} disabled={!!busy} icon="edit">
              {t("sales.draft.saveDraft")}
            </Button>
            <Button variant="primary" onClick={place} loading={busy === "order"} disabled={!!busy} icon="check">
              {t("sales.draft.createOrder")}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-5">
          <Card title={t("sales.draft.products")} description={t("sales.draft.productsDesc")} actions={err("lines") ? <span className="text-[12px] text-a-danger">{err("lines")}</span> : null}>
            <ProductPicker products={products} onAdd={addLine} inOrder={d.lines} />
            <LayoutGroup>
              <ul className="mt-4 grid gap-2">
                <AnimatePresence initial={false}>
                  {priced.map((l, i) => {
                    const over = !!l.p?.tracked && l.qty > l.stock;
                    const img = l.p?.colors.find((c) => c.name === l.color)?.image;
                    return (
                      <motion.li key={`${l.productId}|${l.color}|${l.size}`} layout initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: isRtl ? -16 : 16, transition: { duration: 0.18 } }} transition={{ duration: 0.26, ease }} className={cx("flex items-center gap-3 rounded-xl border px-3 py-2.5", over ? "border-a-danger/40 bg-a-danger/[0.05]" : "border-a-line bg-a-panel-2/40")}>
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-[#f1f1ee]">{img ? <Image src={img} alt="" fill sizes="48px" className="object-cover" /> : null}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{l.p?.title ?? t("sales.draft.deletedProduct")}</span>
                          <span className="block text-[12px] text-a-faint">
                            {l.color} · {l.size} · <bdi dir="ltr">{egp(l.unit)}</bdi>
                          </span>
                          {l.p?.tracked ? <span className={cx("block text-[11.5px]", over ? "text-a-danger" : l.stock <= 3 ? "text-a-warn" : "text-a-faint")}>{over ? t("sales.draft.onlyLeft", { count: l.stock }) : t("sales.draft.inStock", { count: l.stock })}</span> : null}
                        </span>
                        <Stepper value={l.qty} max={999} onChange={(qty) => set("lines", d.lines.map((x, j) => (j === i ? { ...x, qty } : x)))} label={t("sales.draft.qtyOf", { title: l.p?.title ?? t("sales.draft.item") })} />
                        <span className="hidden w-24 text-end text-[13.5px] font-medium tabular-nums sm:block"><bdi dir="ltr">{egp(l.unit * l.qty)}</bdi></span>
                        <IconBtn icon="trash" label={t("sales.draft.remove")} onClick={() => set("lines", d.lines.filter((_, j) => j !== i))} />
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
            {!d.lines.length ? <p className="mt-4 rounded-xl border border-dashed border-a-line-strong px-4 py-6 text-center text-[13px] text-a-faint">{t("sales.draft.noProducts")}</p> : null}
          </Card>

          <Card title={t("sales.draft.payment")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("sales.draft.discount")} htmlFor="disc-kind">
                <Select id="disc-kind" value={d.discount.kind} onChange={(e) => set("discount", { kind: e.target.value as DiscountKind, value: undefined, code: e.target.value === "code" ? (codes.find((c) => c.active)?.code ?? "") : undefined })}>
                  <option value="none">{t("sales.draft.discountKind.none")}</option>
                  <option value="code">{t("sales.draft.discountKind.code")}</option>
                  <option value="amount">{t("sales.draft.discountKind.amount")}</option>
                  <option value="pct">{t("sales.draft.discountKind.pct")}</option>
                </Select>
              </Field>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={d.discount.kind} initial={{ opacity: 0, x: isRtl ? -6 : 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRtl ? 6 : -6 }} transition={{ duration: 0.16, ease }}>
                  {d.discount.kind === "code" ? (
                    <Field label={t("sales.draft.code")} htmlFor="disc-code" error={err("code") ?? (discError && d.discount.code ? discError : undefined)}>
                      <Select id="disc-code" value={d.discount.code ?? ""} onChange={(e) => set("discount", { kind: "code", code: e.target.value })}>
                        <option value="">{t("sales.draft.chooseCode")}</option>
                        {codes.map((c) => (
                          <option key={c.code} value={c.code} disabled={!c.active}>
                            {c.code} — {c.pct ? t("sales.draft.pctOff", { pct: c.pct }) : egp(c.amount ?? 0)}
                            {c.active ? "" : ` ${t("sales.draft.paused")}`}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : d.discount.kind === "amount" || d.discount.kind === "pct" ? (
                    <Field label={d.discount.kind === "pct" ? t("sales.draft.percentOff") : t("sales.draft.amountOff")} htmlFor="disc-val">
                      <Input id="disc-val" type="number" min={0} max={d.discount.kind === "pct" ? 100 : undefined} inputMode="decimal" value={d.discount.value ?? ""} onChange={(e) => set("discount", { kind: d.discount.kind, value: e.target.value === "" ? undefined : Number(e.target.value) })} suffix={d.discount.kind === "pct" ? "%" : "EGP"} />
                    </Field>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                </motion.div>
              </AnimatePresence>
              <Field label={t("sales.draft.shipping")} htmlFor="ship" hint={gov ? (Number.isFinite(d.shippingFee) && d.shippingFee !== gov.rate ? <button type="button" className="text-a-accent hover:underline" onClick={() => (set("shippingFee", gov.rate), setShipTouched(false))}>{t("sales.draft.useRate", { gov: gov.name, rate: egp(gov.rate) })}</button> : t("sales.draft.rateFrom", { gov: gov.name })) : t("sales.draft.pickGov")}>
                <Input
                  id="ship"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={shipping}
                  onChange={(e) => {
                    setShipTouched(true);
                    set("shippingFee", e.target.value === "" ? 0 : Number(e.target.value));
                  }}
                  suffix="EGP"
                />
              </Field>
              <Field label={t("sales.draft.paymentMethod")} htmlFor="pay">
                <Select id="pay" value={d.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as DraftInput["paymentMethod"])}>
                  {methods.map((m) => (
                    <option key={m} value={m}>
                      {t(`sales.method.${m}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <dl className="mt-5 grid gap-2 rounded-xl bg-a-ink/[0.03] p-4 text-[13.5px]">
              <Row label={t("sales.draft.subtotalItems", { count: totals.subtotal ? priced.reduce((n, l) => n + l.qty, 0) : 0 })} value={<bdi dir="ltr">{egp(totals.subtotal)}</bdi>} />
              <AnimatePresence initial={false}>
                {totals.bogo && offer.bogo ? (
                  <motion.div key="bogo" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }}>
                    <Row label={t("sales.order.totals.bogoN", { buy: offer.bogo.buy, get: offer.bogo.get })} value={<bdi dir="ltr">{`− ${egp(totals.bogo)}`}</bdi>} tone="text-a-ok" />
                  </motion.div>
                ) : null}
                {totals.multi && offer.multi ? (
                  <motion.div key="multi" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }}>
                    <Row label={t("sales.order.totals.multiN", { qty: offer.multi.qty, pct: offer.multi.pct })} value={<bdi dir="ltr">{`− ${egp(totals.multi)}`}</bdi>} tone="text-a-ok" />
                  </motion.div>
                ) : null}
                {totals.discount ? (
                  <motion.div key="disc" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }}>
                    <Row label={`${t("sales.draft.discountRow")}${disc.code ? ` (${disc.code})` : ""}`} value={<bdi dir="ltr">{`− ${egp(totals.discount)}`}</bdi>} tone="text-a-ok" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <Row label={t("sales.draft.shipping")} value={totals.shipping ? <bdi dir="ltr">{egp(totals.shipping)}</bdi> : t("sales.draft.free")} />
              <div className="my-1 h-px bg-a-line" />
              <Row label={<span className="font-semibold">{t("sales.draft.total")}</span>} value={<motion.span key={totals.total} dir="ltr" initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className="inline-block font-semibold">{egp(totals.total)}</motion.span>} />
            </dl>
          </Card>

          <Card title={t("sales.draft.notes")}>
            <Textarea aria-label={t("sales.draft.notesAria")} rows={3} value={d.notes} placeholder={t("sales.draft.notesPh")} onChange={(e) => set("notes", e.target.value)} />
          </Card>
        </div>

        <div className="grid gap-5 lg:sticky lg:top-4">
          <Card title={t("sales.draft.customer")}>
            <CustomerSearch
              customers={customers}
              onPick={(c) =>
                setD((x) => {
                  const g = governorates.find((y) => y.name === c.address.governorate);
                  return { ...x, customer: { name: c.name, phone: c.phone, email: c.email ?? "" }, address: { ...c.address, landmark: c.address.landmark ?? "" }, shippingFee: shipTouched || !g ? x.shippingFee : g.rate };
                })
              }
            />
            <div className="mt-4 grid gap-3">
              <Field label={t("sales.draft.fullName")} htmlFor="c-name" error={err("name")}>
                <Input id="c-name" autoComplete="off" value={d.customer.name} onChange={(e) => setCustomer({ name: e.target.value })} />
              </Field>
              <Field label={t("sales.draft.mobile")} htmlFor="c-phone" error={err("phone")}>
                <Input id="c-phone" dir="ltr" inputMode="tel" autoComplete="off" placeholder="01x xxxx xxxx" value={d.customer.phone} onChange={(e) => setCustomer({ phone: e.target.value.replace(/[^\d\s+]/g, "").slice(0, 16) })} />
              </Field>
              <Field label={t("sales.draft.emailOptional")} htmlFor="c-email">
                <Input id="c-email" type="email" autoComplete="off" value={d.customer.email ?? ""} onChange={(e) => setCustomer({ email: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card title={t("sales.draft.shippingAddress")}>
            <div className="grid gap-3">
              <Field label={t("sales.draft.governorate")} htmlFor="a-gov" error={err("governorate")}>
                <Select
                  id="a-gov"
                  value={d.address.governorate}
                  onChange={(e) => {
                    const g = governorates.find((y) => y.name === e.target.value);
                    setD((x) => ({ ...x, address: { ...x.address, governorate: e.target.value }, shippingFee: shipTouched || !g ? x.shippingFee : g.rate }));
                  }}
                >
                  <option value="">{t("sales.draft.choose")}</option>
                  {governorates.map((g) => (
                    <option key={g.name} value={g.name}>
                      {g.name} — {egp(g.rate)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("sales.draft.city")} htmlFor="a-city" error={err("city")}>
                <Input id="a-city" value={d.address.city} onChange={(e) => setAddress({ city: e.target.value })} />
              </Field>
              <Field label={t("sales.draft.street")} htmlFor="a-street" error={err("street")}>
                <Input id="a-street" value={d.address.street} onChange={(e) => setAddress({ street: e.target.value })} />
              </Field>
              <Field label={t("sales.draft.building")} htmlFor="a-bld">
                <Input id="a-bld" value={d.address.building} onChange={(e) => setAddress({ building: e.target.value })} />
              </Field>
              <Field label={t("sales.draft.landmarkOptional")} htmlFor="a-lm">
                <Input id="a-lm" value={d.address.landmark ?? ""} onChange={(e) => setAddress({ landmark: e.target.value })} />
              </Field>
            </div>
          </Card>

          {draft ? (
            <div className="flex justify-end">
              <ConfirmButton onConfirm={removeDraft} confirmLabel={t("sales.draft.confirmDelete")}>
                {t("sales.draft.deleteDraft")}
              </ConfirmButton>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, tone }: { label: React.ReactNode; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-a-dim">{label}</dt>
      <dd className={cx("tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

function Stepper({ value, onChange, max, min = 1, label }: { value: number; onChange: (n: number) => void; max: number; min?: number; label: string }) {
  const { t } = useT();
  return (
    <span className="flex h-8 items-center rounded-lg ring-1 ring-a-line" role="group" aria-label={label}>
      <button type="button" aria-label={t("sales.draft.decrease")} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="grid size-8 place-items-center text-a-dim transition hover:text-a-text disabled:opacity-35">
        <AIcon name="minus" size={13} />
      </button>
      <motion.span key={value} initial={{ y: -4, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="w-7 text-center text-[13px] font-medium tabular-nums">
        {value}
      </motion.span>
      <button type="button" aria-label={t("sales.draft.increase")} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="grid size-8 place-items-center text-a-dim transition hover:text-a-text disabled:opacity-35">
        <AIcon name="plus" size={13} />
      </button>
    </span>
  );
}

/* ───────────── product → colour → size → qty ───────────── */

function ProductPicker({ products, onAdd, inOrder }: { products: PickerProduct[]; onAdd: (l: DraftLineInput) => void; inOrder: DraftLineInput[] }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [pick, setPick] = useState<{ p: PickerProduct; color: string; size: string; qty: number } | null>(null);
  const { t: tr } = useT();
  const t = q.trim().toLowerCase();
  const results = products.filter((p) => !t || p.title.toLowerCase().includes(t)).slice(0, 8);
  const reserved = (p: PickerProduct, color: string, size: string) => inOrder.filter((l) => l.productId === p.id && l.color === color && l.size === size).reduce((n, l) => n + l.qty, 0);

  const choose = (p: PickerProduct) => {
    const color = p.colors.find((c) => p.sizes.some((s) => (p.stock[c.name]?.[s] ?? 0) > 0))?.name ?? p.colors[0]?.name ?? "";
    setPick({ p, color, size: "", qty: 1 });
    setQ("");
    setFocus(false);
  };

  const left = pick && pick.size ? (pick.p.tracked ? Math.max(0, (pick.p.stock[pick.color]?.[pick.size] ?? 0) - reserved(pick.p, pick.color, pick.size)) : 999) : 0;

  return (
    <div>
      <div className="relative">
        <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
        <Input
          aria-label={tr("sales.draft.searchProducts")}
          placeholder={tr("sales.draft.searchProductsPh")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) (e.preventDefault(), choose(results[0]));
            if (e.key === "Escape") setFocus(false);
          }}
          className="ps-9"
        />
        <AnimatePresence>
          {focus ? (
            <motion.ul initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16, ease }} className="a-scroll absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-a-line-strong bg-a-panel-2 p-1 shadow-[0_20px_50px_-16px_var(--a-shadow)]" role="listbox">
              {results.length ? (
                results.map((p) => {
                  const total = Object.values(p.stock).reduce((n, m) => n + Object.values(m).reduce((a, b) => a + b, 0), 0);
                  return (
                    <li key={p.id}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(p)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start transition hover:bg-a-hover">
                        <span className="relative h-10 w-8 shrink-0 overflow-hidden rounded-md bg-[#f1f1ee]">{p.colors[0]?.image ? <Image src={p.colors[0].image} alt="" fill sizes="32px" className="object-cover" /> : null}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{p.title}</span>
                          <span className="text-[11.5px] text-a-faint">
                            <bdi dir="ltr">{egp(p.price)}</bdi> · {p.tracked ? tr("sales.draft.inStock", { count: total }) : tr("sales.draft.notTracked")} {p.status !== "active" ? `· ${p.status === "draft" ? tr("common.draft") : p.status === "archived" ? tr("common.archived") : p.status}` : ""}
                          </span>
                        </span>
                        <AIcon name="plus" size={14} className="text-a-dim" />
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-4 text-center text-[12.5px] text-a-faint">{tr("sales.draft.noProductsMatch", { q })}</li>
              )}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {pick ? (
          <motion.div key={pick.p.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-4 rounded-xl border border-a-violet/30 bg-a-violet/[0.05] p-3.5 sm:flex-row">
              <span className="relative h-28 w-22 shrink-0 self-start overflow-hidden rounded-lg bg-[#f1f1ee]">
                {pick.p.colors.find((c) => c.name === pick.color)?.image ? <Image src={pick.p.colors.find((c) => c.name === pick.color)!.image} alt="" fill sizes="88px" className="object-cover" /> : null}
              </span>
              <div className="grid min-w-0 flex-1 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium">{pick.p.title}</p>
                  <IconBtn icon="close" label={tr("common.cancel")} onClick={() => setPick(null)} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] text-a-dim">
                    {tr("sales.draft.colour")} <span className="text-a-text">{pick.color}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pick.p.colors.map((c) => (
                      <button key={c.name} type="button" title={c.name} aria-label={c.name} aria-pressed={pick.color === c.name} onClick={() => setPick({ ...pick, color: c.name, size: "", qty: 1 })} className={cx("size-7 rounded-full ring-2 ring-offset-2 ring-offset-a-panel transition", pick.color === c.name ? "ring-a-accent" : "ring-transparent hover:ring-a-line-strong")} style={{ background: c.hex }} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] text-a-dim">{tr("sales.draft.size")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pick.p.sizes.map((s) => {
                      const n = pick.p.tracked ? Math.max(0, (pick.p.stock[pick.color]?.[s] ?? 0) - reserved(pick.p, pick.color, s)) : 999;
                      const on = pick.size === s;
                      return (
                        <button key={s} type="button" disabled={!n} aria-pressed={on} onClick={() => setPick({ ...pick, size: s, qty: 1 })} className={cx("relative min-w-12 rounded-lg px-2.5 py-1.5 text-center text-[12.5px] ring-1 transition disabled:cursor-not-allowed disabled:opacity-40", on ? "bg-a-accent/15 text-a-text ring-a-accent" : "ring-a-line hover:ring-a-line-strong")}>
                          <span className="block font-medium">{s}</span>
                          <span className={cx("block text-[10.5px]", !n ? "text-a-danger" : n <= 3 ? "text-a-warn" : "text-a-faint")}>{pick.p.tracked ? (n ? tr("sales.draft.left", { count: n }) : tr("sales.draft.soldOut")) : "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Stepper value={pick.qty} max={Math.max(1, left)} onChange={(qty) => setPick({ ...pick, qty })} label={tr("sales.draft.quantity")} />
                  <Button
                    variant="primary"
                    size="sm"
                    icon="plus"
                    disabled={!pick.size || !left}
                    onClick={() => {
                      onAdd({ productId: pick.p.id, color: pick.color, size: pick.size, qty: pick.qty });
                      setPick(null);
                    }}
                  >
                    {pick.size ? tr("sales.draft.add", { price: egp((pick.p.prices[`${pick.color}|${pick.size}`] ?? pick.p.price) * pick.qty) }) : tr("sales.draft.chooseSize")}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CustomerSearch({ customers, onPick }: { customers: PickerCustomer[]; onPick: (c: PickerCustomer) => void }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const { t: tr } = useT();
  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, "");
  const results = t ? customers.filter((c) => c.name.toLowerCase().includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))).slice(0, 6) : [];
  return (
    <div className="relative">
      <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-[18px] -translate-y-1/2 text-a-faint" />
      <Input aria-label={tr("sales.draft.findCustomer")} placeholder={tr("sales.draft.findCustomerPh")} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} className="ps-9" />
      <AnimatePresence>
        {focus && t ? (
          <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16, ease }} className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-xl border border-a-line-strong bg-a-panel-2 p-1 shadow-[0_20px_50px_-16px_var(--a-shadow)]">
            {results.length ? (
              results.map((c) => (
                <li key={c.phone}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(c);
                      setQ("");
                      setFocus(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition hover:bg-a-hover"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-a-violet/15 text-[12px] font-semibold text-a-accent">{c.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{c.name}</span>
                      <span className="block truncate text-[11.5px] text-a-faint">
                        <bdi dir="ltr">{c.phone}</bdi> · {c.address.governorate} · {tr("sales.draft.customerOrders", { count: c.orders })}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-[12.5px] text-a-faint">{tr("sales.draft.noCustomerMatch")}</li>
            )}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
