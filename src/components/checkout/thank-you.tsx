"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Badge, Button, ButtonLink } from "@/components/ui/primitives";
import { colorStock, completeTheLook, getProductById, getProducts, withColorStock } from "@/lib/catalog";
import { cx, shortDate } from "@/lib/format";
import { langHeaders } from "@/lib/i18n/store/api";
import { multiBuyRowLabel } from "@/components/ui/offer-chip";
import { bogoLabel } from "@/lib/pricing";
import { getOffer, getSite } from "@/lib/site";
import { ORDER_KEY, useLastOrder, type OrderSnapshot } from "./order";
import { Timeline, type TimelineStep } from "./timeline";

/** Mirrors the server rule in /api/orders/[number]/add (which re-prices and is authoritative). */
const UPSELL_DISCOUNT = 0.2;
const UPSELL_WINDOW_MS = 30 * 60_000;

export function ThankYou() {
  const { ready, order } = useLastOrder();
  const { d } = useI18n();
  const T = d.checkout.thanks;

  if (!ready) {
    return (
      <div className="container-x max-w-3xl space-y-4 py-12" aria-busy="true" aria-label={T.loading}>
        <div className="h-48 animate-pulse rounded-[28px] bg-surface" />
        <div className="h-64 animate-pulse rounded-[28px] bg-surface" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-x mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <span className="mb-6 grid size-16 place-items-center rounded-full bg-surface">
          <Icon name="package" size={26} />
        </span>
        <h1 className="text-h2">{T.noneTitle}</h1>
        <p className="mt-2 text-[16px] text-muted">{T.noneBody}</p>
        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink href="/track-order">{T.trackAn}</ButtonLink>
          <ButtonLink href="/" variant="light">
            {T.continue}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return <Confirmed order={order} />;
}

function Confirmed({ order }: { order: OrderSnapshot }) {
  const { d, t, money, locale, product, color: colorLabel, gov } = useI18n();
  const T = d.checkout.thanks;
  const TT = d.checkout.totals;
  const PAYMENT_LABEL = T.paymentLabel;
  const [upsellTotal, setUpsellTotal] = useState(0);
  // the snapshot keeps the English (order) data; titles/colours are shown in the page language
  const lineTitle = (l: OrderSnapshot["lines"][number]) => {
    const p = getProductById(l.productId);
    return p ? product(p).title : l.title;
  };
  const lineColor = (l: OrderSnapshot["lines"][number]) => colorLabel(getProductById(l.productId), l.color);
  const first = order.name.split(/\s+/)[0];
  const created = new Date(order.createdAt);
  const eta: [Date, Date] = [new Date(order.eta[0]), new Date(order.eta[1])];
  const etaLabel = eta[0].toDateString() === eta[1].toDateString() ? shortDate(eta[0], locale) : `${shortDate(eta[0], locale)} – ${shortDate(eta[1], locale)}`;
  const total = order.totals.total + upsellTotal;
  const waText = t(T.waText, { store: getSite().name, number: order.number, total: money(total), payment: PAYMENT_LABEL[order.payment] });

  const steps: TimelineStep[] = [
    // step 1 is "Order placed" (same label as /track-order): the shopper still has to confirm on WhatsApp, so "Confirmed" here contradicted the tracker
    { icon: "check", title: d.checkout.track.flow.pending, note: created.toLocaleTimeString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit" }) },
    { icon: "package", title: T.steps.packed, note: created.getHours() < getOffer().cutoffHour ? T.steps.today : T.steps.tomorrow },
    { icon: "truck", title: T.steps.shipped, note: order.shipping === "express" ? T.steps.express : T.steps.courier },
    { icon: "home", title: T.steps.delivered, note: etaLabel },
  ];

  return (
    <div className="container-x max-w-[1120px] pb-24 pt-6 md:pt-10">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
        <div className="min-w-0 space-y-4">
          <header className="rounded-[28px] bg-surface p-5 md:p-10">
            <span className="mb-5 grid size-12 animate-[pop_.5s_var(--ease-out-soft)] place-items-center rounded-full bg-ink text-white">
              <Icon name="check" size={24} strokeWidth={2.2} />
            </span>
            <p className="text-[14px] text-muted">
              {T.order.split("{number}")[0]}
              <bdi dir="ltr" className="font-semibold tabular-nums text-ink">
                {order.number}
              </bdi>
              {T.order.split("{number}")[1]}
            </p>
            <h1 className="mt-1 text-h1">{t(T.title, { name: first })}</h1>
            <p className="mt-3 text-[16px] text-ink-2">
              {T.arrives.split("{date}")[0]}
              <b className="text-ink">{etaLabel}</b>
              {T.arrives.split("{date}")[1]}
            </p>
          </header>

          {/* COD confirmation — reduces refused deliveries */}
          {order.payment === "cod" ? (
            <section className="rounded-[28px] bg-ink p-5 text-white md:p-8" aria-labelledby="confirm-h">
              <h2 id="confirm-h" className="text-h3">
                {T.confirmTitle}
              </h2>
              <p className="mt-1.5 text-[15px] text-white/75">{T.confirmBody}</p>
              <a
                href={`https://wa.me/${getSite().whatsapp}?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tap mt-5 flex h-14 items-center justify-center gap-2 rounded-full bg-[#25d366] text-[16px] font-semibold text-ink transition hover:brightness-105 active:scale-[0.98]"
              >
                <Icon name="whatsapp" size={20} /> {T.confirmCta}
              </a>
            </section>
          ) : null}

          <section className="rounded-[28px] bg-surface p-5 md:p-8" aria-labelledby="status-h">
            <h2 id="status-h" className="mb-6 text-h3">
              {T.status}
            </h2>
            <Timeline steps={steps} current={1} />
          </section>

          <PostPurchaseUpsell order={order} onAdd={(price) => setUpsellTotal((t) => t + price)} />

        </div>

        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-24" aria-label={d.checkout.orderSummary}>
          <section className="rounded-[28px] bg-surface p-5 md:p-8">
            <h2 className="mb-5 text-h3">{d.checkout.summary}</h2>
            <ul className="space-y-4">
              {order.lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3.5">
                  <span className="relative shrink-0">
                    <span className="relative block aspect-[4/5] w-14 overflow-hidden rounded-xl bg-well">
                      <Image src={l.image} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                    <span className="absolute -inset-e-2 -top-2 grid size-[22px] place-items-center rounded-full bg-ink text-[11px] font-bold text-white tabular-nums">{l.qty}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/products/${l.handle}`} className="block truncate text-[14px] font-semibold">
                      {lineTitle(l)}
                    </Link>
                    <span className="text-[13px] text-muted">
                      {lineColor(l)}
                      {l.size !== "One size" ? ` / ${l.size}` : ""}
                    </span>
                  </span>
                  <span className="text-[14px] font-medium tabular-nums">{l.total === 0 ? TT.free : money(l.total)}</span>
                </li>
              ))}
              {order.bump ? (
                <li className="flex justify-between gap-3 text-[14px]">
                  <span className="font-semibold">{order.bump.title}</span>
                  <span className="tabular-nums">{money(order.bump.price)}</span>
                </li>
              ) : null}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[15px]">
              <Row l={TT.subtotal.replace(" ({n})", "").replace(" ({n})", "")} v={money(order.totals.subtotal)} />
              {order.totals.bogoDiscount ? <Row l={bogoLabel(locale) || TT.bundle} v={`−${money(order.totals.bogoDiscount)}`} save /> : null}
              {order.totals.multiDiscount ? <Row l={multiBuyRowLabel(locale)} v={`−${money(order.totals.multiDiscount)}`} save /> : null}
              {order.totals.promoDiscount ? <Row l={TT.discountCode} v={`−${money(order.totals.promoDiscount)}`} save /> : null}
              {order.totals.prepaidDiscount ? <Row l={TT.onlinePaymentShort} v={`−${money(order.totals.prepaidDiscount)}`} save /> : null}
              <Row l={TT.shipping} v={order.totals.shipping ? money(order.totals.shipping) : TT.free} save={!order.totals.shipping} />
              {order.totals.protection ? <Row l={TT.protection} v={money(order.totals.protection)} /> : null}
              {upsellTotal ? <Row l={TT.addedAfter} v={money(upsellTotal)} /> : null}
              <div className="flex items-baseline justify-between border-t border-line pt-3 text-[18px] font-semibold">
                <dt>{TT.total}</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
            {order.totals.totalSavings ? <p className="mt-2 text-end text-[13px] font-semibold text-forest tabular-nums">{t(TT.youSaved, { amount: money(order.totals.totalSavings) })}</p> : null}

            <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-[14px] sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <dt className="mb-1 text-[13px] text-muted">{T.deliverTo}</dt>
                <dd className="leading-relaxed">
                  {order.name}
                  <br />
                  {[order.address.building, order.address.street].filter(Boolean).join(locale === "ar" ? "، " : ", ")}
                  <br />
                  {order.address.city}
                  {locale === "ar" ? "، " : ", "}
                  {gov(order.address.governorate)}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-[13px] text-muted">{T.payment}</dt>
                <dd>{PAYMENT_LABEL[order.payment]}</dd>
              </div>
            </dl>
          </section>

          <div className="flex flex-col gap-2">
            <ButtonLink href="/collections/new">
              {T.keepShopping} <Icon name="arrowUpRight" size={17} />
            </ButtonLink>
            <ButtonLink href="/track-order" variant="light">
              {T.track}
            </ButtonLink>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ l, v, save }: { l: string; v: string; save?: boolean }) {
  return (
    <div className={cx("flex justify-between gap-4", save && "text-forest")}>
      <dt className={save ? "" : "text-ink-2"}>{l}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

/** One-click add to the same shipment — no re-entering details, no extra delivery fee. */
function PostPurchaseUpsell({ order, onAdd }: { order: OrderSnapshot; onAdd: (price: number) => void }) {
  const { d, t, money, locale, product } = useI18n();
  const U = d.checkout.thanks.upsell;
  const owned = new Set(order.lines.map((l) => l.productId));
  const anchor = getProductById(order.lines[0]?.productId ?? "");
  // first related product that still has a colour in stock, viewed through that colour's per-size stock
  const base = (anchor ? completeTheLook(anchor, 3) : []).concat(getProducts()).find((p) => !owned.has(p.id) && p.colors.some((c) => colorStock(p, c.name) > 0));
  const pickColor = base?.colors.find((c) => colorStock(base, c.name) > 0) ?? base?.colors[0];
  const pick = base && pickColor ? withColorStock(base, pickColor.name) : undefined;
  const purchasedSize = order.lines.find((l) => l.size !== "One size")?.size;
  const [size, setSize] = useState<string | null>(() => {
    if (!pick) return null;
    if (pick.sizes.length === 1) return pick.sizes[0].label;
    const hit = pick.sizes.find((s) => s.label === purchasedSize && s.stock);
    return hit ? hit.label : null;
  });
  const [state, setState] = useState<"idle" | "loading" | "added">("idle");
  const [error, setError] = useState("");
  // the server only accepts additions for 30 minutes after ordering — don't offer it afterwards
  const [open] = useState(() => Date.now() - new Date(order.createdAt).getTime() < UPSELL_WINDOW_MS);
  if (!pick || !open) return null;
  const price = Math.round(pick.price * (1 - UPSELL_DISCOUNT));

  const add = async () => {
    if (!size) return;
    setState("loading");
    setError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.number)}/add`, {
        method: "POST",
        headers: { "content-type": "application/json", ...langHeaders(locale) },
        body: JSON.stringify({ phone: order.phone, productId: pick.id, color: pickColor?.name ?? pick.colors[0].name, size }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; line?: { title: string; color: string; size: string; image: string; total: number }; totals?: { total: number; itemCount: number; subtotal: number } };
      if (!res.ok || !json.line || !json.totals) throw new Error(json.error || U.failed);
      setState("added");
      onAdd(json.line.total);
      try {
        const raw = sessionStorage.getItem(ORDER_KEY);
        if (raw) {
          const o = JSON.parse(raw) as OrderSnapshot;
          o.lines.push({ key: `${pick.id}|upsell`, productId: pick.id, handle: pick.handle, title: json.line.title, color: json.line.color, size: json.line.size, qty: 1, image: json.line.image, total: json.line.total, free: 0 });
          o.totals = { ...o.totals, total: json.totals.total, itemCount: json.totals.itemCount, subtotal: json.totals.subtotal };
          sessionStorage.setItem(ORDER_KEY, JSON.stringify(o));
        }
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : U.failed);
      setState("idle");
    }
  };

  return (
    <section className="rounded-[28px] bg-surface p-5 md:p-8" aria-labelledby="upsell-h">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="upsell-h" className="text-h3">
          {U.title}
        </h2>
        <Badge tone="dark">
          <bdi dir="ltr">−{Math.round(UPSELL_DISCOUNT * 100)}%</bdi>
        </Badge>
      </div>
      <div className="flex gap-4">
        <Link href={`/products/${pick.handle}`} className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-2xl bg-well sm:w-36">
          <Image src={(pickColor ?? pick.colors[0]).images[0]} alt={product(pick).title} fill sizes="144px" className="object-cover" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[16px] font-semibold leading-snug">{product(pick).title}</p>
          <p className="mt-0.5 text-[14px] text-muted">{U.shipsTogether}</p>
          <p className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-[17px] font-semibold text-sale">{money(price)}</span>
            <s className="text-[13px] text-muted">{money(pick.price)}</s>
          </p>
          {pick.sizes.length > 1 && state !== "added" ? (
            <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={U.size}>
              {pick.sizes.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  role="radio"
                  aria-checked={size === s.label}
                  disabled={!s.stock}
                  onClick={() => setSize(s.label)}
                  className={cx("tap h-10 min-w-11 rounded-full px-3 text-[13px] font-semibold ring-1 transition disabled:text-muted disabled:line-through disabled:opacity-50", size === s.label ? "bg-ink text-white ring-ink" : "bg-surface ring-ink/15 hover:ring-ink/30")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-auto pt-4">
            {state === "added" ? (
              <p className="flex h-12 items-center justify-center gap-2 rounded-full bg-sage-soft text-[14px] font-semibold text-forest" role="status">
                <Icon name="check" size={18} /> {U.added}
              </p>
            ) : (
              <Button className="w-full" onClick={add} loading={state === "loading"} disabled={!size || state === "loading"}>
                {size ? t(U.addFor, { amount: money(price) }) : U.chooseSize}
              </Button>
            )}
            {error ? (
              <p className="mt-2 text-[13px] font-medium text-sale" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
