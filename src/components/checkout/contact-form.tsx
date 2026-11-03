"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/primitives";
import { normalizeEgPhone } from "@/lib/egypt";
import { langHeaders } from "@/lib/i18n/store/api";
import { Field, SelectField } from "./fields";

export function ContactForm() {
  const { d, locale } = useI18n();
  const C = d.checkout.contactForm;
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const v = (k: string) => String(data.get(k) ?? "").trim();
    const errs: Record<string, string> = {};
    if (v("c-name").length < 2) errs["c-name"] = C.errName;
    if (v("c-phone") && !normalizeEgPhone(v("c-phone"))) errs["c-phone"] = C.errPhone;
    if (v("c-email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("c-email"))) errs["c-email"] = C.errEmail;
    if (!v("c-phone") && !v("c-email")) errs["c-phone"] = C.errContact;
    if (v("c-message").length < 10) errs["c-message"] = C.errMessage;
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) return document.getElementById(first)?.focus();
    setState("sending");
    setServerError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", ...langHeaders(locale) },
        body: JSON.stringify({ name: v("c-name"), phone: v("c-phone"), email: v("c-email"), topic: v("c-topic"), message: v("c-message"), website: v("c-website") }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        if (json.field) setErrors({ [`c-${json.field}`]: json.error ?? C.checkField });
        throw new Error(json.error || C.failed);
      }
      setState("sent");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : C.failedShort);
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-5" role="status">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white">
          <Icon name="check" size={20} />
        </span>
        <div>
          <p className="font-semibold">{C.sentTitle}</p>
          <p className="text-[14px] text-ink-2">{C.sentBody}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative grid gap-4 sm:grid-cols-2">
      <Field id="c-name" label={C.name} autoComplete="name" error={errors["c-name"]} />
      <Field id="c-phone" label={C.phone} type="tel" dir="ltr" inputMode="tel" autoComplete="tel-national" placeholder="010 1234 5678" error={errors["c-phone"]} />
      <Field id="c-email" label={C.email} optional type="email" dir="ltr" autoComplete="email" error={errors["c-email"]} className="sm:col-span-2" />
      <SelectField id="c-topic" label={C.topic} defaultValue="order" className="sm:col-span-2">
        <option value="order">{C.topics.order}</option>
        <option value="exchange">{C.topics.exchange}</option>
        <option value="product">{C.topics.product}</option>
        <option value="other">{C.topics.something}</option>
      </SelectField>
      <div className="sm:col-span-2">
        <label htmlFor="c-message" className="mb-1.5 block text-[14px] font-medium">
          {C.message}
        </label>
        <textarea
          id="c-message"
          name="c-message"
          rows={5}
          aria-invalid={!!errors["c-message"]}
          aria-describedby={errors["c-message"] ? "c-message-err" : undefined}
          className="w-full resize-y rounded-2xl bg-surface p-4 text-[16px] ring-1 ring-ink/15 outline-none transition hover:ring-ink/30 focus:ring-2 focus:ring-ink aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-sale"
        />
        {errors["c-message"] ? (
          <p id="c-message-err" role="alert" className="mt-1.5 text-[12.5px] font-medium text-sale">
            {errors["c-message"]}
          </p>
        ) : null}
      </div>
      {/* honeypot — hidden from people, bots fill it */}
      <div aria-hidden className="absolute -inset-s-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">{C.website}</label>
        <input id="c-website" name="c-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {serverError ? (
        <p className="text-[14px] font-medium text-sale sm:col-span-2" role="alert">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" className="sm:col-span-2 sm:justify-self-start" loading={state === "sending"} disabled={state === "sending"}>
        {state === "sending" ? C.sending : C.send}
      </Button>
    </form>
  );
}
