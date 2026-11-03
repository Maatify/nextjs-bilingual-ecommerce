"use client";

import Link from "@/components/i18n/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { getCollection } from "@/lib/catalog";
import { enabledPayments } from "@/lib/checkout";
import type { I18n } from "@/lib/i18n/store/kit";
import { bogoLabel, multiBuy, multiBuyLabel } from "@/lib/pricing";
import { getOffer, getPromoCodes } from "@/lib/site";
import { actions, useStore } from "@/lib/store";

type Offer = { icon: IconName; title: string; body: string; href: string; cta: string; code?: string };

/** Live offers from /admin → Settings: each card only shows while its offer is switched on. */
function getOffers({ d, t, p, money, locale }: I18n): Offer[] {
  const OFFER = getOffer();
  const o = d.layout.offers;
  const bogo = bogoLabel(locale);
  const link = (handle: string, cta: string) => (getCollection(handle) ? { href: `/collections/${handle}`, cta } : { href: "/collections/all", cta: d.common.shopAll });
  const welcome = getPromoCodes()[OFFER.welcomeCode?.toUpperCase()];
  const prepaid = OFFER.prepaidDiscountPct > 0 && enabledPayments().some((m) => m === "card" || m === "wallet");
  const out: Offer[] = [];
  const mb = multiBuy();
  if (mb) out.push({ icon: "tag", title: multiBuyLabel(locale), body: t(o.multiBody, { qty: mb.qty, pct: mb.pct }), href: "/collections/all", cta: d.common.shopAll });
  if (bogo) out.push({ icon: "tag", title: bogo, body: p(o.bogoBody, OFFER.bogo.get, { total: OFFER.bogo.buy + OFFER.bogo.get }), href: "/collections/all", cta: d.common.shopAll });
  if (welcome)
    out.push({
      icon: "sparkle",
      // the merchant's promo label is English-only → Arabic shows our own line
      title: (locale === "en" && welcome.label) || t(o.welcomeTitle, { pct: OFFER.welcomePct }),
      body: bogo ? t(o.stacks, { offer: bogo }) : o.appliedAtCheckout,
      ...link("new", o.newDrop),
      code: welcome.code.toUpperCase(),
    });
  if (OFFER.freeShippingAt > 0) out.push({ icon: "truck", title: o.freeShipping, body: t(o.freeShippingBody, { amount: money(OFFER.freeShippingAt) }), ...link("bestsellers", o.bestsellers) });
  if (prepaid) out.push({ icon: "card", title: t(o.prepaidTitle, { pct: OFFER.prepaidDiscountPct }), body: o.prepaidBody, href: "/pages/shipping", cta: o.howItWorks });
  return out;
}

/** MAVIN-style notification bell: a live "offers inbox" with an unread dot until opened. */
export function OffersBell() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);
  const promo = useStore((s) => s.promo);
  const i18n = useI18n();
  const { d, t } = i18n;
  const OFFERS = getOffers(i18n);
  if (!OFFERS.length) return null;

  return (
    <>
      <IconButton
        label={seen ? d.layout.offers.bell : t(d.layout.offers.bellNew, { n: OFFERS.length })}
        className="relative"
        onClick={() => {
          setOpen(true);
          setSeen(true);
        }}
      >
        <Icon name="bell" size={21} />
        {!seen ? (
          <span className="absolute inset-e-1 top-1 grid size-[18px] place-items-center rounded-full bg-sale text-[10px] font-bold text-white" aria-hidden>
            {OFFERS.length}
          </span>
        ) : null}
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title={d.layout.offers.title} side="responsive">
        <ul className="space-y-3 pb-2">
          {OFFERS.map((o) => (
            <li key={o.title} className="rounded-2xl bg-surface-2 p-4">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-white">
                  <Icon name={o.icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{o.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{o.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {o.code ? (
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(o.code!);
                          } catch {}
                          actions.setPromo(o.code!);
                          setCopied(o.code!);
                        }}
                        className="tap flex h-9 items-center gap-2 rounded-full border border-dashed border-forest px-3.5 text-[12px] font-bold tracking-[0.12em] text-forest"
                      >
                        <bdi dir="ltr">{o.code}</bdi>
                        <span className="font-semibold tracking-normal">{copied === o.code || promo === o.code ? d.layout.offers.applied : d.layout.offers.tapToApply}</span>
                      </button>
                    ) : null}
                    <Link href={o.href} onClick={() => setOpen(false)} className="tap flex h-9 items-center gap-1 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-white">
                      {o.cta} <Icon name="arrowRight" size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
