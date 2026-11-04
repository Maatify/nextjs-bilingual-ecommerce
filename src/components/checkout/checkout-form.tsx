"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Badge, Button, ButtonLink } from "@/components/ui/primitives";
import { BUMP_DISCOUNT_PCT, enabledPayments, expressAvailableFor, getBump, priceCheckout } from "@/lib/checkout";
import { getSettings } from "@/lib/data";
import { getGovernorates, normalizeEgPhone } from "@/lib/egypt";
import { cx, shortDate } from "@/lib/format";
import { langHeaders } from "@/lib/i18n/store/api";
import type { Dict } from "@/lib/i18n/store/en";
import { installment } from "@/lib/pricing";
import { getOffer } from "@/lib/site";
import type { Order } from "@/lib/types";
import { actions, useStore } from "@/lib/store";
import { CheckboxCard, Field, RadioCard, SectionTitle, SelectField } from "./fields";
import { deliveryWindow, ORDER_KEY, type OrderSnapshot, type PaymentMethod } from "./order";
import { PromoField } from "./promo-field";
import { SummaryLines, TotalsList } from "./summary";

const DRAFT_KEY = "vedra:checkoutDraft";

interface Form {
  phone: string;
  email: string;
  whatsapp: boolean;
  name: string;
  governorate: string;
  city: string;
  street: string;
  building: string;
  landmark: string;
  notes: string;
  shipping: "standard" | "express";
  payment: PaymentMethod;
  provider: "valU" | "Sympl" | "Souhoola";
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  cardName: string;
  bump: boolean;
  protection: boolean;
}

type Errors = Partial<Record<keyof Form, string>>;

const blank: Form = {
  phone: "",
  email: "",
  whatsapp: true,
  name: "",
  governorate: "",
  city: "",
  street: "",
  building: "",
  landmark: "",
  notes: "",
  shipping: "standard",
  payment: "cod",
  provider: "valU",
  cardNumber: "",
  cardExpiry: "",
  cardCvc: "",
  cardName: "",
  bump: false,
  protection: false,
};

// Order matters: first invalid field in this list receives focus on submit.
const FIELD_ORDER: (keyof Form)[] = ["phone", "email", "name", "governorate", "city", "street", "building", "cardNumber", "cardExpiry", "cardCvc", "cardName"];

function validate(f: Form, E: Dict["checkout"]["errors"]): Errors {
  const e: Errors = {};
  if (!f.phone.trim()) e.phone = E.phoneRequired;
  else if (!normalizeEgPhone(f.phone)) e.phone = E.phoneInvalid;
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = E.email;
  if (f.name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = E.name;
  if (!f.governorate) e.governorate = E.governorate;
  if (f.city.trim().length < 2) e.city = E.city;
  if (f.street.trim().length < 4) e.street = E.street;
  if (!f.building.trim()) e.building = E.building;
  if (f.payment === "card") {
    const digits = f.cardNumber.replace(/\D/g, "");
    if (digits.length < 15) e.cardNumber = E.cardNumber;
    const [mm, yy] = f.cardExpiry.split("/").map((x) => Number(x));
    const now = new Date();
    const expired = !mm || mm > 12 || !yy || 2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
    if (expired) e.cardExpiry = E.cardExpiry;
    if (!/^\d{3,4}$/.test(f.cardCvc)) e.cardCvc = E.cardCvc;
    if (f.cardName.trim().length < 3) e.cardName = E.cardName;
  }
  return e;
}

const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function loadDraft(): Form {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<Form>;
    // Card data and one-time choices are never restored.
    return { ...blank, ...saved, cardNumber: "", cardExpiry: "", cardCvc: "", cardName: "", bump: false, protection: false };
  } catch {
    return blank;
  }
}

const CHECKOUT_SESSION_KEY = "vedra_checkout_session";
/** One id per checkout session (per tab) for the abandoned-checkout beacon; reset after an order is placed. */
function checkoutSessionId() {
  try {
    const have = sessionStorage.getItem(CHECKOUT_SESSION_KEY);
    if (have && /^[A-Za-z0-9-]{16,64}$/.test(have)) return have;
    const id = globalThis.crypto?.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(CHECKOUT_SESSION_KEY, id);
    return id;
  } catch {
    return "nostorage-" + Math.random().toString(36).slice(2, 14);
  }
}

/** Mounted only after the client store has hydrated, so reading localStorage in the initializer is safe. */
export function CheckoutForm() {
  // one Idempotency-Key per form instance: retries/double submits return the same order instead of a duplicate
  const [idemKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""));
  const router = useRouter();
  const { d, t, money, locale, href, gov: govName, product, color: colorLabel } = useI18n();
  const C = d.checkout;
  const cart = useStore((s) => s.cart);
  const promo = useStore((s) => s.promo);
  const [f, setF] = useState<Form>(loadDraft);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const OFFER = getOffer();
  const co = getSettings().checkout;
  const governorates = getGovernorates();
  const payments = enabledPayments();
  const BUMP = getBump();
  const bumpTitle = BUMP ? product(BUMP.product).title : "";
  // A saved draft may point at a method the admin has since switched off.
  const payment: PaymentMethod = payments.includes(f.payment) ? f.payment : payments[0];

  // cheap, and reads the live snapshot too — recomputed each render (React Compiler memoizes it)
  const priced = priceCheckout({ cart, governorate: f.governorate, shipping: f.shipping, payment, promo, protection: f.protection, bump: f.bump });
  const { totals, gov, express, base } = priced;
  const expressAvailable = expressAvailableFor(gov?.name);

  const window_ = deliveryWindow(gov?.days ?? [2, 4], express);
  const etaLabel = window_[0].getTime() === window_[1].getTime() ? shortDate(window_[0], locale) : `${shortDate(window_[0], locale)} – ${shortDate(window_[1], locale)}`;

  // Persist the draft (contact + address only) so a refresh or ad-click return doesn't lose progress.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const { phone, email, whatsapp, name, governorate, city, street, building, landmark, notes, shipping, payment, provider } = f;
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ phone, email, whatsapp, name, governorate, city, street, building, landmark, notes, shipping, payment, provider }));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [f]);

  // Abandoned-checkout beacon: once there's a valid phone or email and a bag, tell the store (debounced 2s).
  // Lets the merchant follow up on WhatsApp with a cart-restore link. Contact + bag only — no address.
  useEffect(() => {
    if (placed) return;
    const phone = normalizeEgPhone(f.phone);
    const email = /^\S+@\S+\.\S+$/.test(f.email.trim()) ? f.email.trim() : "";
    if ((!phone && !email) || !cart.length) return;
    const body = JSON.stringify({
      id: checkoutSessionId(),
      customer: { name: f.name.trim() || undefined, phone: phone ?? undefined, email: email || undefined },
      governorate: f.governorate || undefined,
      lines: cart.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })),
    });
    let sent = false;
    const send = (beacon: boolean) => {
      if (sent) return;
      sent = true;
      try {
        if (beacon && navigator.sendBeacon?.("/api/checkouts", new Blob([body], { type: "text/plain" }))) return;
        fetch("/api/checkouts", { method: "POST", headers: { "content-type": "application/json", ...langHeaders(locale) }, body, keepalive: true }).catch(() => {});
      } catch {}
    };
    const t = setTimeout(() => send(false), 2000);
    const flush = () => send(true);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pagehide", flush);
    };
  }, [f.phone, f.email, f.name, f.governorate, cart, placed, locale]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const blur = (k: keyof Form) => () => {
    const msg = validate({ ...f, payment }, C.errors)[k];
    // Only surface errors on blur for fields the shopper actually typed in.
    if (msg && String(f[k]).trim()) setErrors((e) => ({ ...e, [k]: msg }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate({ ...f, payment }, C.errors);
    setErrors(errs);
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) {
      const el = document.getElementById(first);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    placeOrder().catch(() => {
      setSubmitting(false);
      setSubmitError(C.review.offline);
    });
  };

  const placeOrder = async () => {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idemKey, ...langHeaders(locale) },
      body: JSON.stringify({
        lines: cart.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })),
        customer: { name: f.name.trim(), phone: f.phone, email: f.email.trim() || undefined, whatsappUpdates: f.whatsapp },
        address: { governorate: f.governorate, city: f.city, street: f.street, building: f.building, landmark: f.landmark, notes: f.notes },
        shipping: express ? "express" : "standard",
        payment,
        promoCode: totals.promoCode,
        protection: f.protection,
        bump: !!(f.bump && BUMP),
        source: "web",
        locale,
        website: (document.getElementById("co-website") as HTMLInputElement | null)?.value ?? "",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { number?: string; order?: Order; error?: string; field?: keyof Form };
    if (!res.ok || !data.order) {
      setSubmitting(false);
      if (data.field && data.field in blank) {
        setErrors((e) => ({ ...e, [data.field!]: data.error }));
        document.getElementById(data.field)?.focus();
      }
      setSubmitError(data.error ?? C.review.failed);
      return;
    }
    const placedOrder = data.order;
    {
      const order: OrderSnapshot = {
        number: placedOrder.number,
        createdAt: placedOrder.createdAt,
        name: f.name.trim(),
        phone: normalizeEgPhone(f.phone)!,
        email: f.email.trim() || undefined,
        whatsappUpdates: f.whatsapp,
        address: { governorate: f.governorate, city: f.city.trim(), street: f.street.trim(), building: f.building.trim(), landmark: f.landmark.trim() || undefined, notes: f.notes.trim() || undefined },
        shipping: placedOrder.shipping,
        payment,
        eta: [window_[0].toISOString(), window_[1].toISOString()],
        lines: totals.lines.map((l) => ({
          key: l.key,
          productId: l.productId,
          handle: l.product.handle,
          title: l.product.title,
          color: l.color,
          size: l.size,
          qty: l.qty,
          image: (l.product.colors.find((c) => c.name === l.color) ?? l.product.colors[0]).images[0],
          total: l.total,
          free: l.freeUnits,
        })),
        bump: placedOrder.totals.bump && BUMP ? { title: t(C.review.bumpTitle, { title: bumpTitle, pct: BUMP_DISCOUNT_PCT }), price: placedOrder.totals.bump } : null,
        // server-priced figures win; savings/gift flags come from the same pricing functions
        totals: { ...placedOrder.totals, itemCount: totals.itemCount, totalSavings: totals.totalSavings, gift: totals.gift },
      };
      try {
        sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
        sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, notes: "" }));
      } catch {}
      setPlaced(true);
      router.push(href("/checkout/thank-you"));
      actions.clearCart();
    }
  };

  if (placed) {
    return (
      <div className="grid min-h-[60dvh] place-items-center" role="status">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="size-10 animate-spin rounded-full border-[3px] border-ink border-e-transparent" aria-hidden />
          <p className="text-[15px] font-semibold">{C.confirming}</p>
        </div>
      </div>
    );
  }

  if (!totals.itemCount) {
    return (
      <div className="container-x py-16">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-[28px] bg-surface px-5 py-14 text-center">
          <span className="mb-6 grid size-16 place-items-center rounded-full bg-surface-2">
            <Icon name="bag" size={26} />
          </span>
          <h1 className="text-h2">{C.emptyTitle}</h1>
          <p className="mt-2 text-[16px] text-muted">{C.emptyBody}</p>
          <ButtonLink href="/collections/bestsellers" className="mt-8">
            {C.shopBestsellers} <Icon name="arrowUpRight" size={17} />
          </ButtonLink>
        </div>
      </div>
    );
  }

  const prepaidSave = Math.round(((totals.subtotal - totals.bogoDiscount - totals.multiDiscount - totals.promoDiscount) * OFFER.prepaidDiscountPct) / 100);
  const prepaidOn = payments.includes("card") || payments.includes("wallet");
  const summary = (
    <>
      <SummaryLines lines={totals.lines} extra={f.bump && BUMP ? { title: bumpTitle, image: BUMP.product.colors[0].images[0], price: BUMP.price, note: t(C.review.bumpNote, { pct: BUMP_DISCOUNT_PCT }) } : null} />
      <PromoField discount={totals.promoDiscount} merch={totals.subtotal - totals.bogoDiscount - totals.multiDiscount} className="mt-6" />
      <TotalsList totals={totals} shippingKnown={!!gov} shippingHint={C.totals.chooseGov} className="mt-1" />
      {totals.gift ? (
        <p className="mt-3 flex items-center gap-2 text-[14px] text-forest">
          <Icon name="gift" size={16} /> {t(C.review.giftIncluded, { gift: OFFER.giftName })}
        </p>
      ) : null}
    </>
  );

  const panel = "rounded-[24px] bg-surface p-5 md:p-8";

  return (
    <div className="container-x pb-16 pt-4 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-6">
      {/* Mobile order summary toggle */}
      <div className="mb-4 overflow-hidden rounded-[24px] bg-surface lg:hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((v) => !v)}
          aria-expanded={summaryOpen}
          aria-controls="mobile-summary"
          className="tap flex h-14 w-full items-center justify-between gap-3 px-5 text-[15px]"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Icon name="bag" size={18} />
            {t(summaryOpen ? C.summaryToggle.hide : C.summaryToggle.show, { n: totals.itemCount })}
            <Icon name="chevronDown" size={16} className={cx("transition-transform duration-300", summaryOpen && "rotate-180")} />
          </span>
          <span className="text-[17px] font-semibold tabular-nums">{money(totals.total)}</span>
        </button>
        <div id="mobile-summary" className={cx("grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-soft)]", summaryOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!summaryOpen}>
          <div className="overflow-hidden">
            <div className="border-t border-line px-5 pb-6 pt-5">{summary}</div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="min-w-0 space-y-4">
        <h1 className="sr-only">{C.heading}</h1>
        {/* honeypot — hidden from people, bots fill it (same pattern as contact-form.tsx) */}
        <div aria-hidden className="absolute -inset-s-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="co-website">{d.checkout.contactForm.website}</label>
          <input id="co-website" name="co-website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Contact */}
        <section aria-labelledby="contact-h" className={panel}>
          <SectionTitle step={1}>
            <span id="contact-h">{C.contact.title}</span>
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="phone"
              label={C.contact.phone}
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={C.contact.phonePlaceholder}
              prefix="+20"
              value={f.phone}
              onChange={(e) => set("phone", e.target.value.replace(/[^\d\s+]/g, "").slice(0, 16))}
              onBlur={blur("phone")}
              error={errors.phone}
              hint={C.contact.phoneHint}
            />
            <Field id="email" label={C.contact.email} optional type="email" dir="ltr" inputMode="email" autoComplete="email" placeholder={C.contact.emailPlaceholder} value={f.email} onChange={(e) => set("email", e.target.value)} onBlur={blur("email")} error={errors.email} />
            <CheckboxCard checked={f.whatsapp} onChange={(v) => set("whatsapp", v)} className="!p-3.5 sm:col-span-2">
              <span className="flex items-center gap-2 text-[15px]">
                <Icon name="whatsapp" size={18} className="text-[#1f9e4f]" /> {C.contact.whatsapp}
              </span>
            </CheckboxCard>
          </div>
        </section>

        {/* Delivery */}
        <section aria-labelledby="delivery-h" className={panel}>
          <SectionTitle step={2}>
            <span id="delivery-h">{C.delivery.title}</span>
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label={C.delivery.name} autoComplete="name" placeholder={C.delivery.namePlaceholder} value={f.name} onChange={(e) => set("name", e.target.value)} onBlur={blur("name")} error={errors.name} className="sm:col-span-2" />
            <SelectField id="governorate" label={C.delivery.governorate} autoComplete="address-level1" value={f.governorate} onChange={(e) => set("governorate", e.target.value)} error={errors.governorate}>
              <option value="" disabled>
                {C.select}
              </option>
              {governorates.map((g) => (
                <option key={g.name} value={g.name}>
                  {govName(g.name)}
                </option>
              ))}
            </SelectField>
            <Field id="city" label={C.delivery.city} autoComplete="address-level2" placeholder={C.delivery.cityPlaceholder} value={f.city} onChange={(e) => set("city", e.target.value)} onBlur={blur("city")} error={errors.city} />
            <Field id="street" label={C.delivery.street} autoComplete="address-line1" placeholder={C.delivery.streetPlaceholder} value={f.street} onChange={(e) => set("street", e.target.value)} onBlur={blur("street")} error={errors.street} className="sm:col-span-2" />
            <Field id="building" label={C.delivery.building} autoComplete="address-line2" placeholder={C.delivery.buildingPlaceholder} value={f.building} onChange={(e) => set("building", e.target.value)} onBlur={blur("building")} error={errors.building} />
            <Field id="landmark" label={C.delivery.landmark} optional placeholder={C.delivery.landmarkPlaceholder} value={f.landmark} onChange={(e) => set("landmark", e.target.value)} />
            <Field id="notes" label={C.delivery.notes} optional placeholder={C.delivery.notesPlaceholder} value={f.notes} onChange={(e) => set("notes", e.target.value)} className="sm:col-span-2" />
          </div>

          <div className="mt-6">
            <p className="mb-2.5 text-[14px] font-medium">{C.delivery.shipping}</p>
            {!gov ? (
              <p className="rounded-2xl bg-surface-2 px-4 py-3.5 text-[14px] text-muted">{C.delivery.chooseGov}</p>
            ) : (
              <div className="space-y-2.5" role="radiogroup" aria-label={C.delivery.shippingMethod}>
                <RadioCard
                  name="shipping"
                  value="standard"
                  checked={!express}
                  onChange={() => set("shipping", "standard")}
                  title={C.delivery.standard}
                  description={!express ? t(C.delivery.arrives, { date: etaLabel }) : t(C.delivery.businessDays, { from: gov.days[0], to: gov.days[1] })}
                  aside={base.freeShipping ? <span className="text-forest">{C.delivery.free}</span> : money(gov.rate)}
                />
                {expressAvailable ? (
                  <RadioCard
                    name="shipping"
                    value="express"
                    checked={express}
                    onChange={() => set("shipping", "express")}
                    title={C.delivery.express}
                    badge={<Badge tone="amber">{C.delivery.nextDay}</Badge>}
                    description={express ? t(C.delivery.arrives, { date: etaLabel }) : t(C.delivery.orderBefore, { hour: OFFER.cutoffHour })}
                    aside={<bdi dir="ltr">+{money(co.expressFee)}</bdi>}
                  />
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* Payment */}
        <section aria-labelledby="pay-h" className={panel}>
          <SectionTitle step={3} aside={<span className="flex items-center gap-1 text-[13px] text-muted"><Icon name="lock" size={14} /> {C.payment.secure}</span>}>
            <span id="pay-h">{C.payment.title}</span>
          </SectionTitle>
          <div className="space-y-2.5" role="radiogroup" aria-label={C.payment.method}>
            {payments.includes("cod") ? (
            <RadioCard
              name="payment"
              value="cod"
              checked={payment === "cod"}
              onChange={(v) => set("payment", v as PaymentMethod)}
              title={C.payment.cod}
              description={C.payment.codDescription}
              aside={<Icon name="cash" size={22} className="text-muted" />}
            >
              <p className="text-[14px] text-ink-2">
                {C.payment.codNote}
                {prepaidOn && prepaidSave > 0 ? t(C.payment.codSave, { amount: money(prepaidSave) }) : ""}
              </p>
            </RadioCard>
            ) : null}
            {payments.includes("card") ? (
            <RadioCard
              name="payment"
              value="card"
              checked={payment === "card"}
              onChange={(v) => set("payment", v as PaymentMethod)}
              title={C.payment.card}
              badge={
                <Badge tone="forest">
                  <bdi dir="ltr">−{OFFER.prepaidDiscountPct}%</bdi>
                </Badge>
              }
              description={C.payment.cardDescription}
              aside={<Icon name="card" size={22} className="text-muted" />}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field id="cardNumber" label={C.payment.cardNumber} dir="ltr" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={f.cardNumber} onChange={(e) => set("cardNumber", fmtCard(e.target.value))} onBlur={blur("cardNumber")} error={errors.cardNumber} className="col-span-2" />
                <Field id="cardExpiry" label={C.payment.expiry} dir="ltr" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={f.cardExpiry} onChange={(e) => set("cardExpiry", fmtExpiry(e.target.value))} onBlur={blur("cardExpiry")} error={errors.cardExpiry} />
                <Field id="cardCvc" label={C.payment.cvc} dir="ltr" inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={f.cardCvc} onChange={(e) => set("cardCvc", e.target.value.replace(/\D/g, "").slice(0, 4))} onBlur={blur("cardCvc")} error={errors.cardCvc} />
                <Field id="cardName" label={C.payment.cardName} dir="ltr" autoComplete="cc-name" value={f.cardName} onChange={(e) => set("cardName", e.target.value)} onBlur={blur("cardName")} error={errors.cardName} className="col-span-2" />
              </div>
            </RadioCard>
            ) : null}
            {payments.includes("wallet") ? (
            <RadioCard
              name="payment"
              value="wallet"
              checked={payment === "wallet"}
              onChange={(v) => set("payment", v as PaymentMethod)}
              title={C.payment.wallet}
              badge={
                <Badge tone="forest">
                  <bdi dir="ltr">−{OFFER.prepaidDiscountPct}%</bdi>
                </Badge>
              }
              description={C.payment.walletDescription}
              aside={<Icon name="phone" size={22} className="text-muted" />}
            >
              <p className="text-[14px] text-ink-2">{C.payment.walletNote}</p>
            </RadioCard>
            ) : null}
            {payments.includes("installments") ? (
            <RadioCard
              name="payment"
              value="installments"
              checked={payment === "installments"}
              onChange={(v) => set("payment", v as PaymentMethod)}
              title={C.payment.installments}
              description={t(C.payment.installmentsDescription, { amount: money(installment(totals.total)) })}
              aside={<span className="text-[12px] font-bold text-muted">valU</span>}
            >
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={C.payment.provider}>
                {(["valU", "Sympl", "Souhoola"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={f.provider === p}
                    onClick={() => set("provider", p)}
                    className={cx("tap h-11 rounded-full px-5 text-[14px] font-semibold ring-1 transition", f.provider === p ? "bg-ink text-white ring-ink" : "bg-surface ring-ink/15 hover:ring-ink/30")}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </RadioCard>
            ) : null}
          </div>
        </section>

        {/* Order bump + protection + submit */}
        <section aria-label={C.review.label} className={panel}>
          <div className="space-y-2.5">
            {BUMP ? (
            <CheckboxCard checked={f.bump} onChange={(v) => set("bump", v)}>
              <span className="flex items-center gap-3.5">
                <span className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl bg-well">
                  <Image src={BUMP.product.colors[0].images[0]} alt={t(C.review.bumpImageAlt, { title: bumpTitle, color: colorLabel(BUMP.product, BUMP.product.colors[0].name) })} fill sizes="64px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{t(C.review.bumpAdd, { title: bumpTitle })}</span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[14px] tabular-nums">
                    <b className="text-sale">{money(BUMP.price)}</b>
                    <s className="text-muted">{money(BUMP.product.price)}</s>
                    <span className="text-muted">{C.review.checkoutOnly}</span>
                  </span>
                </span>
              </span>
            </CheckboxCard>
            ) : null}
            {co.protectionEnabled ? (
            <CheckboxCard checked={f.protection} onChange={(v) => set("protection", v)}>
              <span className="flex items-center gap-3">
                <Icon name="shield" size={20} className="shrink-0 text-muted" />
                <span className="text-[15px]">
                  {C.review.protection} <span className="text-muted tabular-nums">· {money(OFFER.protection)}</span>
                </span>
              </span>
            </CheckboxCard>
            ) : null}
          </div>

          <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-line pt-5">
            <span className="text-[16px] font-semibold">{C.review.total}</span>
            <span className="text-end">
              <span className="block text-[26px] font-semibold leading-none tracking-tight tabular-nums">{money(totals.total)}</span>
              <span className="mt-1 block text-[13px] text-muted">{gov ? t(C.delivery.arrives, { date: etaLabel }) : C.review.shippingAfterGov}</span>
            </span>
          </div>

          <Button type="submit" size="lg" className="mt-5 h-16 w-full text-[17px]" loading={submitting} disabled={submitting}>
            {submitting ? C.review.placing : payment === "cod" ? t(C.review.completeCod, { amount: money(totals.total) }) : payment === "installments" ? t(C.review.continueTo, { provider: f.provider }) : t(C.review.pay, { amount: money(totals.total) })}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-muted">
            <Icon name="lock" size={14} /> {payment === "cod" ? C.review.payOnDelivery : C.review.securePayment} · {C.review.freeExchange}
          </p>
          {submitError ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-sale/10 px-4 py-3.5 text-[14px] text-ink" role="alert">
              <Icon name="info" size={18} className="mt-0.5 shrink-0 text-sale" />
              <span className="min-w-0 flex-1">
                <b className="block font-semibold">{C.review.notPlaced}</b>
                {submitError}
              </span>
            </div>
          ) : Object.values(errors).some(Boolean) ? (
            <p className="mt-3 text-center text-[14px] font-medium text-sale" role="alert">
              {C.review.fixFields}
            </p>
          ) : null}
        </section>

        <nav aria-label={C.policies.label} className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-4 text-[13px] text-muted">
          {[
            [C.policies.returns, "/pages/returns"],
            [C.policies.shipping, "/pages/shipping"],
            [C.policies.privacy, "/pages/privacy"],
            [C.policies.terms, "/pages/terms"],
            [C.policies.contact, "/pages/contact"],
          ].map(([l, h]) => (
            <Link key={h} href={h} className="underline-offset-4 hover:text-ink hover:underline">
              {l}
            </Link>
          ))}
        </nav>
      </form>

      {/* Desktop summary */}
      <aside className={cx(panel, "sticky top-24 hidden lg:block")} aria-label={C.orderSummary}>
        <h2 className="mb-5 text-h3">{C.summary}</h2>
        {summary}
      </aside>
    </div>
  );
}
