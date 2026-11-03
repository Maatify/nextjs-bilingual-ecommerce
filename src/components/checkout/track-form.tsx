"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";
import { getGovernorates, normalizeEgPhone } from "@/lib/egypt";
import { shortDate } from "@/lib/format";
import { langHeaders } from "@/lib/i18n/store/api";
import { getSite } from "@/lib/site";
import type { OrderStatus } from "@/lib/types";
import { Field } from "./fields";
import { deliveryWindow, useLastOrder } from "./order";
import { Timeline, type TimelineStep } from "./timeline";

interface Result {
  number: string;
  status: OrderStatus;
  createdAt: string;
  shipping: "standard" | "express";
  governorate: string;
  timeline: { status: OrderStatus; at: string }[];
}

const FLOW: { status: "pending" | "confirmed" | "packed" | "shipped" | "delivered"; icon: TimelineStep["icon"] }[] = [
  { status: "pending", icon: "check" },
  { status: "confirmed", icon: "phone" },
  { status: "packed", icon: "package" },
  { status: "shipped", icon: "truck" },
  { status: "delivered", icon: "home" },
];

export function TrackForm() {
  const { order } = useLastOrder();
  const { d, t, locale } = useI18n();
  const T = d.checkout.track;
  const date = (v: Date) => shortDate(v, locale);
  const [errors, setErrors] = useState<{ number?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const site = getSite();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const number = String(data.get("number")).trim().toUpperCase().replace(/\s+/g, "");
    const phone = String(data.get("phone"));
    const errs: typeof errors = {};
    if (!/^VD-?\d{5,8}$/.test(number)) errs.number = T.errNumber;
    if (!normalizeEgPhone(phone)) errs.phone = T.errPhone;
    setErrors(errs);
    setLookupError(null);
    if (errs.number) return document.getElementById("number")?.focus();
    if (errs.phone) return document.getElementById("phone")?.focus();
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/track?${new URLSearchParams({ number, phone })}`, { cache: "no-store", headers: langHeaders(locale) });
      const json = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) {
        setResult(null);
        setLookupError(json.error ?? T.notFound);
      } else setResult(json);
    } catch {
      setResult(null);
      setLookupError(T.offline);
    } finally {
      setLoading(false);
    }
  };

  const at = (s: OrderStatus) => result?.timeline.findLast((t) => t.status === s)?.at;
  const closed = result?.status === "cancelled" || result?.status === "returned";
  const stage = result ? (result.status === "delivered" ? FLOW.length : Math.max(0, FLOW.findIndex((f) => f.status === result.status))) : 0;
  const gov = result ? getGovernorates().find((g) => g.name === result.governorate) : undefined;
  const eta = result ? deliveryWindow(gov?.days ?? [2, 4], result.shipping === "express", new Date(result.createdAt))[1] : null;

  const steps: TimelineStep[] = FLOW.map((f, i) => {
    const when = at(f.status);
    return {
      icon: f.icon,
      title: T.flow[f.status],
      note: when ? date(new Date(when)) : f.status === "delivered" && eta ? t(T.expected, { date: date(eta) }) : i === stage ? T.inProgress : T.next,
    };
  });

  return (
    <div className="space-y-4">
      <form key={order?.number ?? "empty"} onSubmit={submit} noValidate className="grid gap-4 rounded-[28px] bg-surface p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-start md:p-8">
        <Field id="number" label={T.number} dir="ltr" placeholder={T.numberPlaceholder} autoCapitalize="characters" defaultValue={order?.number} error={errors.number} />
        <Field id="phone" label={T.phone} type="tel" dir="ltr" inputMode="tel" autoComplete="tel-national" placeholder="010 1234 5678" defaultValue={order?.phone} error={errors.phone} />
        <Button type="submit" size="lg" className="h-[52px] sm:mt-[27px]" loading={loading} disabled={loading}>
          {T.submit}
        </Button>
      </form>

      {lookupError ? (
        <p className="flex items-start gap-3 rounded-[20px] bg-surface px-5 py-4 text-[15px]" role="alert">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-sale" />
          <span>
            {lookupError}{" "}
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              {T.askWhatsapp}
            </a>
          </span>
        </p>
      ) : null}

      {result ? (
        <section className="rounded-[28px] bg-surface p-5 md:p-8" aria-live="polite" aria-labelledby="track-result">
          <div className="mb-7 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="track-result" className="text-h3">
              {T.order.split("{number}")[0]}
              <bdi dir="ltr" className="tabular-nums">
                {result.number}
              </bdi>
              {T.order.split("{number}")[1]}
            </h2>
            {closed ? (
              <p className="text-[15px] font-semibold text-sale">{result.status === "cancelled" ? T.cancelled : T.returned}</p>
            ) : result.status === "delivered" ? (
              <p className="text-[15px] font-semibold text-forest">{T.delivered}</p>
            ) : eta ? (
              <p className="text-[15px] text-ink-2">
                {T.arrives.split("{date}")[0]}
                <b className="text-ink">{date(eta)}</b>
                {T.arrives.split("{date}")[1]}
              </p>
            ) : null}
          </div>
          {closed ? (
            <p className="text-[15px] text-ink-2">
              {t(T.closedNote, { status: T.statusWord[result.status === "cancelled" ? "cancelled" : "returned"], date: date(new Date(at(result.status) ?? result.createdAt)) })}
            </p>
          ) : (
            <Timeline steps={steps} current={stage} />
          )}
          <a
            href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(t(T.waText, { store: site.name, number: result.number }))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-surface-2 px-5 text-[15px] font-semibold transition hover:bg-well"
          >
            <Icon name="whatsapp" size={18} /> {T.ask}
          </a>
        </section>
      ) : null}
    </div>
  );
}
