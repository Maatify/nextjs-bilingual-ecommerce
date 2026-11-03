"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { cx } from "@/lib/format";
import type { Order, SiteInfo } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { buttonClass, ease, egp } from "../ui";
import { fmtDate } from "./meta";

/* Printable invoice / packing slip. Rendered as a light sheet over the admin; print CSS hides everything else. */

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #print-sheet, #print-sheet * { visibility: visible !important; }
  #print-root { position: absolute !important; inset: 0 0 auto 0 !important; width: 100% !important; overflow: visible !important; background: #fff !important; padding: 0 !important; }
  #print-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
}`;

export function Invoice({ order: o, site, multiBuy }: { order: Order; site: SiteInfo; /** live multi-buy offer, for the totals label */ multiBuy?: { qty: number; pct: number } | null }) {
  const { t: tr, fmt } = useT();
  const [kind, setKind] = useState<"invoice" | "slip">("invoice");
  const slip = kind === "slip";
  const t = o.totals;
  return (
    <div id="print-root" className="fixed inset-0 z-[60] overflow-y-auto bg-[#e7e7e3] px-4 py-6 text-neutral-900 a-scroll md:px-8">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto mb-5 flex max-w-[820px] flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/orders/${o.id}`} className="inline-flex items-center gap-1 text-[13px] text-neutral-600 hover:text-neutral-900">
          <AIcon name="chevronLeft" size={15} className="rtl:-scale-x-100" /> {tr("sales.invoice.back", { number: o.number })}
        </Link>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-[10px] bg-white p-1 shadow-sm ring-1 ring-black/5" role="tablist" aria-label={tr("sales.invoice.docType")}>
            {(["invoice", "slip"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cx("relative h-8 rounded-[8px] px-3 text-[13px] font-medium transition-colors", kind === k ? "text-white" : "text-neutral-600 hover:text-neutral-900")}>
                {kind === k ? <motion.span layoutId="inv-tab" className="absolute inset-0 rounded-[8px] bg-neutral-900" transition={{ type: "spring", stiffness: 500, damping: 38 }} /> : null}
                <span className="relative">{k === "invoice" ? tr("sales.invoice.invoice") : tr("sales.invoice.slip")}</span>
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className={buttonClass("primary", "md")}>
            <AIcon name="print" size={16} /> {tr("sales.invoice.print")}
          </button>
        </div>
      </div>

      <motion.article
        id="print-sheet"
        key={kind}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
        className="mx-auto max-w-[820px] rounded-xl bg-white p-8 font-sans text-[13px] leading-relaxed shadow-[0_20px_60px_-25px_rgb(0_0_0/0.35)] md:p-12"
      >
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-6">
          <div>
            <p className="text-[22px] font-semibold tracking-[0.18em]">{site.name.toUpperCase()}</p>
            <p className="mt-1 text-neutral-500">{site.legalName}</p>
            <p className="text-neutral-500"><bdi dir="ltr">{site.url.replace(/^https?:\/\//, "")}</bdi> · <bdi dir="ltr">{site.phone}</bdi></p>
          </div>
          <div className="text-end">
            <p className="text-[18px] font-semibold">{slip ? tr("sales.invoice.slip") : tr("sales.invoice.invoice")}</p>
            <p className="mt-1 tabular-nums text-neutral-600" dir="ltr">{o.number}</p>
            <p className="text-neutral-500">{fmtDate(fmt, o.createdAt, false)}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-neutral-200 py-6 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{tr("sales.invoice.shipTo")}</p>
            <p className="font-medium">{o.customer.name}</p>
            <p className="tabular-nums"><bdi dir="ltr">{o.customer.phone}</bdi></p>
            <p>
              {o.address.street}, {o.address.building}
            </p>
            {o.address.landmark ? <p>{tr("sales.order.near", { landmark: o.address.landmark })}</p> : null}
            <p>
              {o.address.city}, {o.address.governorate}
            </p>
            {o.address.notes ? <p className="mt-1 text-neutral-500">{tr("sales.invoice.note", { note: o.address.notes })}</p> : null}
          </div>
          <div className="sm:text-end">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{slip ? tr("sales.invoice.delivery") : tr("sales.invoice.payment")}</p>
            {slip ? (
              <>
                <p className="font-medium">{o.shipping === "express" ? tr("sales.invoice.express") : tr("sales.invoice.standard")}</p>
                <p>{tr("sales.order.itemsCount", { count: o.totals.itemCount })}</p>
                {o.paymentMethod === "cod" && o.paymentStatus !== "paid" ? <p className="mt-2 text-[15px] font-semibold">{tr("sales.invoice.collect", { total: egp(t.total) })}</p> : <p className="mt-2">{tr("sales.invoice.prepaid")}</p>}
              </>
            ) : (
              <>
                <p className="font-medium">{tr(`sales.method.${o.paymentMethod}`)}</p>
                <p>{tr(`sales.payment.${o.paymentStatus}`)}</p>
                {o.promoCode ? <p className="text-neutral-500">{tr("sales.invoice.code", { code: o.promoCode })}</p> : null}
              </>
            )}
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-start">
          <thead>
            <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-[0.1em] text-neutral-400">
              {slip ? <th className="w-10 pb-2 font-semibold">✓</th> : null}
              <th className="pb-2 text-start font-semibold">{tr("sales.invoice.item")}</th>
              <th className="pb-2 text-start font-semibold">{tr("sales.invoice.variant")}</th>
              <th className="pb-2 text-end font-semibold">{tr("sales.invoice.qty")}</th>
              {!slip ? <th className="pb-2 text-end font-semibold">{tr("sales.invoice.unit")}</th> : null}
              {!slip ? <th className="pb-2 text-end font-semibold">{tr("sales.invoice.total")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-100 align-top">
                {slip ? (
                  <td className="py-3">
                    <span className="block size-4 rounded border border-neutral-400" />
                  </td>
                ) : null}
                <td className="py-3 pe-3 font-medium">
                  {l.title}
                  {l.free ? <span className="ms-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">{tr("sales.order.freeBadge")}</span> : null}
                </td>
                <td className="py-3 pe-3 text-neutral-600">
                  {l.color} / {l.size}
                </td>
                <td className="py-3 text-end tabular-nums">{l.qty}</td>
                {!slip ? <td className="py-3 text-end tabular-nums"><bdi dir="ltr">{egp(l.unit)}</bdi></td> : null}
                {!slip ? <td className="py-3 text-end tabular-nums"><bdi dir="ltr">{l.free && !l.total ? "0" : egp(l.total)}</bdi></td> : null}
              </tr>
            ))}
          </tbody>
        </table>

        {!slip ? (
          <dl className="ms-auto mt-6 w-full max-w-[300px] space-y-1.5 tabular-nums">
            <Row label={tr("sales.order.totals.subtotal")} v={egp(t.subtotal)} />
            {t.bogoDiscount ? <Row label={tr("sales.order.totals.bogo")} v={`− ${egp(t.bogoDiscount)}`} /> : null}
            {t.multiDiscount ? <Row label={multiBuy ? tr("sales.order.totals.multiN", multiBuy) : tr("sales.order.totals.multi")} v={`− ${egp(t.multiDiscount)}`} /> : null}
            {t.promoDiscount ? <Row label={tr("sales.order.totals.promo")} v={`− ${egp(t.promoDiscount)}`} /> : null}
            {t.prepaidDiscount ? <Row label={tr("sales.order.totals.prepaid")} v={`− ${egp(t.prepaidDiscount)}`} /> : null}
            <Row label={tr("sales.invoice.shipping")} v={t.shipping ? egp(t.shipping) : tr("sales.order.free")} />
            {t.protection ? <Row label={tr("sales.order.totals.protection")} v={egp(t.protection)} /> : null}
            {t.bump ? <Row label={tr("sales.invoice.addon")} v={egp(t.bump)} /> : null}
            <div className="flex justify-between border-t border-neutral-300 pt-2 text-[15px] font-semibold">
              <dt>{tr("sales.invoice.total")}</dt>
              <dd dir="ltr">{egp(t.total)}</dd>
            </div>
          </dl>
        ) : null}

        <footer className="mt-10 border-t border-neutral-200 pt-5 text-center text-[12px] text-neutral-500">
          {tr("sales.invoice.thanks", { store: site.name })} <bdi dir="ltr">WhatsApp {site.whatsapp}</bdi> · <bdi dir="ltr">{site.email}</bdi>
        </footer>
      </motion.article>
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between text-neutral-600">
      <dt>{label}</dt>
      <dd className="text-neutral-900" dir="ltr">{v}</dd>
    </div>
  );
}
