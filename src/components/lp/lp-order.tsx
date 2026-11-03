"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { deliveryWindow, ORDER_KEY, type OrderSnapshot } from "@/components/checkout/order";
import { Field, SelectField } from "@/components/checkout/fields";
import { BundleCards } from "@/components/pdp/bundle-cards";
import { ColorThumbs } from "@/components/pdp/color-thumbs";
import { FindMySize } from "@/components/pdp/find-my-size";
import { SizeSelector } from "@/components/pdp/size-selector";
import { resolvePreselect } from "@/components/pdp/product-view";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";
import { variantPrice, withColorStock } from "@/lib/catalog";
import { enabledPayments } from "@/lib/checkout";
import { getGovernorates, normalizeEgPhone } from "@/lib/egypt";
import { shortDate } from "@/lib/format";
import { LP_COLOR_EVENT } from "./lp-gallery";
import { multiBuyRowLabel } from "@/components/ui/offer-chip";
import { bogoLabel, computeTotals } from "@/lib/pricing";
import type { Order, Product } from "@/lib/types";

type Form = { name: string; phone: string; governorate: string; city: string; street: string };
type Errors = Partial<Record<keyof Form | "size", string>>;

/**
 * Ad landing order box — the EasyOrders-style "no cart" COD flow:
 * pick colour/size/quantity offer, fill 5 fields, done. Writes the same
 * OrderSnapshot as /checkout so the thank-you page (WhatsApp confirm, upsell) is shared.
 */
export function LpOrder({ product: p }: { product: Product }) {
  // one Idempotency-Key per form instance: retries/double submits return the same order instead of a duplicate
  const [idemKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""));
  const router = useRouter();
  const { d, t, money, href, locale, product, gov: govName } = useI18n();
  const F = d.lp.form;
  const params = useSearchParams();
  const pre = resolvePreselect(p, { color: params.get("color"), size: params.get("size"), qty: params.get("qty") });
  const [colorIdx, setColorIdx] = useState(pre.colorIdx);
  const [size, setSize] = useState<string | null>(pre.size);
  const [qty, setQty] = useState(pre.qty);
  const [help, setHelp] = useState<null | "finder" | "chart">(null);
  const governorates = getGovernorates();
  const [f, setF] = useState<Form>(() => ({ name: "", phone: "", governorate: governorates.some((g) => g.name === "Cairo") ? "Cairo" : (governorates[0]?.name ?? ""), city: "", street: "" }));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // This is a cash-on-delivery flow; fall back to whatever the store accepts if COD is off.
  const payments = enabledPayments();
  const payment = payments.includes("cod") ? "cod" : payments[0];
  const formRef = useRef<HTMLFormElement>(null);

  const color = p.colors[colorIdx];
  // availability + price for the chosen colour (stock lives on colour × size variants)
  const pc = useMemo(() => withColorStock(p, color.name), [p, color.name]);
  const unit = variantPrice(p, color.name, size ?? undefined).price;
  const pickColor = (i: number) => {
    setColorIdx(i);
    if (size && p.sizes.length > 1 && !withColorStock(p, p.colors[i].name).sizes.find((x) => x.label === size)?.stock) setSize(null);
  };

  // Keep the (separately rendered) gallery on the chosen colour.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(LP_COLOR_EVENT, { detail: colorIdx }));
  }, [colorIdx]);
  const gov = governorates.find((g) => g.name === f.governorate) ?? governorates[0];
  const line = useMemo(() => [{ key: `${p.id}|${color.name}|${size ?? "-"}`, productId: p.id, color: color.name, size: size ?? "-", qty }], [p.id, color.name, size, qty]);
  const totals = useMemo(() => computeTotals(line, { payment, shippingRate: gov?.rate }), [line, gov?.rate, payment]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!size) e.size = F.errSize;
    if (f.name.trim().split(/\s+/).length < 2) e.name = F.errName;
    if (!normalizeEgPhone(f.phone)) e.phone = F.errPhone;
    if (f.city.trim().length < 2) e.city = F.errCity;
    if (f.street.trim().length < 5) e.street = F.errStreet;
    return e;
  };
  const set = (k: keyof Form) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((x) => ({ ...x, [k]: ev.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    const first = (Object.keys(e) as (keyof Errors)[])[0];
    if (first) {
      const el = first === "size" ? document.getElementById("lp-size") : document.getElementById(`lp-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    let data: { order?: Order; error?: string; field?: string } = {};
    let ok = false;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idemKey },
        body: JSON.stringify({
          lines: [{ productId: p.id, color: color.name, size, qty }],
          customer: { name: f.name.trim(), phone: f.phone, whatsappUpdates: true },
          address: { governorate: f.governorate, city: f.city, street: f.street, building: "" },
          shipping: "standard",
          payment,
          source: "lp",
          locale,
          website: (document.getElementById("lp-website") as HTMLInputElement | null)?.value ?? "",
        }),
      });
      ok = res.ok;
      data = await res.json().catch(() => ({}));
    } catch {
      data = { error: F.offline };
    }
    const placed = data.order;
    if (!ok || !placed) {
      setSubmitting(false);
      const field = data.field as keyof Form | undefined;
      if (field && field in f) {
        setErrors((x) => ({ ...x, [field]: data.error }));
        document.getElementById(`lp-${field}`)?.focus();
      }
      setSubmitError(data.error ?? F.failed);
      return;
    }
    const win = deliveryWindow(gov?.days ?? [2, 4], false);
    const order: OrderSnapshot = {
      number: placed.number,
      createdAt: placed.createdAt,
      name: f.name.trim(),
      phone: placed.customer.phone,
      whatsappUpdates: true,
      address: placed.address,
      shipping: "standard",
      payment: placed.paymentMethod,
      eta: [win[0].toISOString(), win[1].toISOString()],
      lines: placed.lines.map((l, i) => ({ key: `${l.productId}|${l.color}|${l.size}|${i}`, productId: l.productId, handle: l.handle, title: l.title, color: l.color, size: l.size, qty: l.qty, image: l.image, total: l.total, free: l.free })),
      bump: null,
      totals: { ...placed.totals, totalSavings: totals.totalSavings, gift: totals.gift },
    };
    try {
      sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {}
    router.push(href("/checkout/thank-you"));
  };

  const win = deliveryWindow(gov?.days ?? [2, 4], false);
  const offer = bogoLabel(locale);

  return (
    <div id="order" className="scroll-mt-20 space-y-6">
      {p.colors.length > 1 ? <ColorThumbs product={p} colorIdx={colorIdx} onChange={pickColor} idPrefix="lp" /> : null}

      <div id="lp-size" className="scroll-mt-24">
        <SizeSelector product={pc} size={size} onSize={(s) => { setSize(s); setErrors((x) => ({ ...x, size: undefined })); }} onHelp={(t) => setHelp(t)} error={!!errors.size} />
        {p.sizes.length > 1 ? (
          <button type="button" onClick={() => setHelp("finder")} className="tap mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-medium transition hover:bg-well">
            <Icon name="ruler" size={16} /> {F.findSize}
          </button>
        ) : null}
        {errors.size ? <p className="mt-2 text-[14px] font-medium text-sale" role="alert">{errors.size}</p> : null}
      </div>

      <BundleCards price={unit} qty={qty} onQty={setQty} name="lp-bundle" />

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-4 border-t border-line pt-6">
        {/* honeypot — hidden from people, bots fill it (same pattern as contact-form.tsx) */}
        <div aria-hidden className="absolute -inset-s-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="lp-website">{d.checkout.contactForm.website}</label>
          <input id="lp-website" name="lp-website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <h2 className="text-h3">{F.deliveryDetails}</h2>
        <Field id="lp-name" label={F.fullName} autoComplete="name" value={f.name} onChange={set("name")} error={errors.name} />
        <Field id="lp-phone" label={F.mobile} dir="ltr" type="tel" inputMode="tel" autoComplete="tel-national" prefix="+20" placeholder="010 0000 0000" value={f.phone} onChange={set("phone")} error={errors.phone} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="lp-governorate" label={F.governorate} value={f.governorate} onChange={set("governorate")} autoComplete="address-level1">
            {governorates.map((g) => (
              <option key={g.name} value={g.name}>
                {govName(g.name)}
              </option>
            ))}
          </SelectField>
          <Field id="lp-city" label={F.city} autoComplete="address-level2" value={f.city} onChange={set("city")} error={errors.city} />
        </div>
        <Field id="lp-street" label={F.address} placeholder={F.addressPh} autoComplete="street-address" value={f.street} onChange={set("street")} error={errors.street} />

        <dl className="space-y-2 rounded-[20px] bg-surface-2 p-4 text-[15px] tabular-nums">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">
              <bdi dir="ltr">{qty} ×</bdi> {product(p).title}
            </dt>
            <dd>{money(totals.subtotal)}</dd>
          </div>
          {totals.bogoDiscount ? (
            <div className="flex justify-between gap-3 text-forest">
              <dt>{offer || F.bundleDiscount}</dt>
              <dd>
                <bdi>−{money(totals.bogoDiscount)}</bdi>
              </dd>
            </div>
          ) : null}
          {totals.multiDiscount ? (
            <div className="flex justify-between gap-3 text-forest">
              <dt>{multiBuyRowLabel(locale)}</dt>
              <dd>
                <bdi>−{money(totals.multiDiscount)}</bdi>
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">{t(F.delivery, { gov: gov ? govName(gov.name) : "" })}</dt>
            <dd>{totals.shipping ? money(totals.shipping) : <span className="font-semibold text-forest">{F.free}</span>}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
            <dt className="font-semibold">{F.total}</dt>
            <dd className="text-[22px] font-semibold tracking-tight">{money(totals.total)}</dd>
          </div>
        </dl>

        {submitError ? (
          <div className="flex items-start gap-3 rounded-2xl bg-sale/10 px-4 py-3.5 text-[14px]" role="alert">
            <Icon name="info" size={18} className="mt-0.5 shrink-0 text-sale" />
            <span className="min-w-0 flex-1">
              <b className="block font-semibold">{F.notPlaced}</b>
              {submitError}
            </span>
          </div>
        ) : null}
        <Button type="submit" size="lg" className="h-16 w-full text-[17px]" loading={submitting} disabled={submitting}>
          {t(F.confirm, { total: money(totals.total) })}
        </Button>
        <p className="text-center text-[13px] text-muted" suppressHydrationWarning>
          {payment === "cod" ? d.common.payOnDelivery : F.securePayment} · {t(F.arrives, { from: shortDate(win[0], locale), to: shortDate(win[1], locale) })} · {d.common.freeExchange}
        </p>
      </form>

      <FindMySize product={pc} open={help !== null} initialTab={help ?? "finder"} onClose={() => setHelp(null)} onSelect={(s) => { if (pc.sizes.find((x) => x.label === s)?.stock) setSize(s); setHelp(null); setErrors((x) => ({ ...x, size: undefined })); }} />
    </div>
  );
}
