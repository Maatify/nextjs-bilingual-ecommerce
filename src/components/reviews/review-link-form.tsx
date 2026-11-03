"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useId, useState, type FormEvent } from "react";
import { Field } from "@/components/checkout/fields";
import { useI18n } from "@/components/i18n/provider";
import { PhotoPicker } from "@/components/reviews/photo-picker";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { cx } from "@/lib/format";
import { langHeaders } from "@/lib/i18n/store/api";
import type { FitTendency } from "@/lib/types";

export interface ReviewLinkItem {
  key: number;
  title: string;
  image: string;
  color: string;
  size: string;
  apparel: boolean;
  handle: string;
}

type Draft = { on: boolean; rating: number; title: string; body: string; fit: FitTendency | null; photos: File[] };
const blank = (): Draft => ({ on: true, rating: 0, title: "", body: "", fit: null, photos: [] });

/** All of an order's products on one page — star picker, title, text, fit and photos each — sent together. */
export function ReviewLinkForm({ token, items, defaultName, defaultCity, reward }: { token: string; items: ReviewLinkItem[]; defaultName: string; defaultCity: string; reward: boolean }) {
  const { d, p: plural, locale } = useI18n();
  const R = d.review;
  const T = d.product.reviews;
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => Object.fromEntries(items.map((it) => [it.key, blank()])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [serverError, setServerError] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const reduce = useReducedMotion();

  const set = (key: number, patch: Partial<Draft>) => {
    setDrafts((all) => ({ ...all, [key]: { ...all[key], ...patch } }));
    // clear that item's errors as the customer fixes them
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`rl-${key}-`))));
  };
  const chosen = items.filter((it) => drafts[it.key].on);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const v = (k: string) => String(form.get(k) ?? "").trim();
    const errs: Record<string, string> = {};
    if (v("rl-name").length < 2) errs["rl-name"] = T.nameErr;
    for (const it of chosen) {
      const x = drafts[it.key];
      if (!x.rating) errs[`rl-${it.key}-rating`] = T.ratingErr;
      if (x.body.trim().length < 10) errs[`rl-${it.key}-body`] = T.bodyErr;
    }
    if (!chosen.length) errs.form = R.nothing;
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      if (first === "form") return;
      const target = first.endsWith("-rating") ? `${first.replace(/-rating$/, "")}-star-1` : first;
      document.getElementById(target)?.focus();
      return;
    }
    setState("sending");
    setServerError("");
    const body = new FormData();
    body.append("token", token);
    body.append("name", v("rl-name"));
    body.append("city", v("rl-city"));
    body.append("website", v("rl-website"));
    body.append("items", JSON.stringify(chosen.map((it) => ({ key: it.key, rating: drafts[it.key].rating, title: drafts[it.key].title, body: drafts[it.key].body, fit: drafts[it.key].fit }))));
    for (const it of chosen) for (const f of drafts[it.key].photos) body.append(`photos-${it.key}`, f);
    try {
      const res = await fetch("/api/reviews/request", { method: "POST", headers: langHeaders(locale), body });
      const json = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        if (json.field) {
          setErrors({ [json.field]: json.error ?? T.sendErr });
          document.getElementById(json.field.endsWith("-rating") ? `${json.field.replace(/-rating$/, "")}-star-1` : json.field)?.focus();
        }
        throw new Error(json.error || T.sendErr);
      }
      setSentCount(chosen.length);
      setState("sent");
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : T.sendErr);
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mt-8 rounded-[24px] bg-surface p-6 md:p-8" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-ink text-white" aria-hidden>
          <Icon name="check" size={22} />
        </span>
        <h2 className="mt-4 text-h3">{R.doneTitle}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{R.doneBody}</p>
        {reward ? <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{R.doneReward}</p> : null}
        <p className="sr-only">{plural(R.submit, sentCount)}</p>
        <ButtonLink href="/collections/all" className="mt-6">
          {R.keepShopping}
        </ButtonLink>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-4">
      <ul className="space-y-4">
        {items.map((it) => (
          <ItemCard key={it.key} item={it} draft={drafts[it.key]} errors={errors} onChange={(patch) => set(it.key, patch)} />
        ))}
      </ul>

      <fieldset className="rounded-[24px] bg-surface p-5 md:p-6">
        <legend className="sr-only">{R.aboutYou}</legend>
        <p className="mb-4 text-[16px] font-semibold" aria-hidden>
          {R.aboutYou}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="rl-name" label={R.name} autoComplete="name" maxLength={60} defaultValue={defaultName} error={errors["rl-name"]} hint={R.nameHint} />
          <Field id="rl-city" label={R.city} optional autoComplete="address-level2" maxLength={60} defaultValue={defaultCity} />
        </div>
        <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
          <Icon name="verified" size={15} className="mt-0.5 shrink-0 text-forest" /> {R.verifiedNote}
        </p>
        <p className="mt-1.5 flex items-start gap-2 text-[13px] text-muted">
          <Icon name="lock" size={15} className="mt-0.5 shrink-0" /> {R.privacy}
        </p>
      </fieldset>

      {/* honeypot — hidden from people, bots fill it */}
      <div aria-hidden className="absolute -inset-s-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="rl-website">Website</label>
        <input id="rl-website" name="rl-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {serverError || errors.form ? (
        <p className="text-[14px] font-medium text-sale" role="alert">
          {serverError || errors.form}
        </p>
      ) : null}
      <div className="sticky bottom-0 -mx-4 bg-bg/[0.97] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={state === "sending"} disabled={state === "sending" || !chosen.length}>
          {state === "sending" ? R.sending : chosen.length ? plural(R.submit, chosen.length) : R.nothing}
        </Button>
      </div>
    </form>
  );
}

function ItemCard({ item: it, draft: x, errors, onChange }: { item: ReviewLinkItem; draft: Draft; errors: Record<string, string>; onChange: (patch: Partial<Draft>) => void }) {
  const { d, t, p: plural } = useI18n();
  const R = d.review;
  const T = d.product.reviews;
  const [hover, setHover] = useState(0);
  const headId = useId();
  const reduce = useReducedMotion();
  const k = `rl-${it.key}`;
  const shown = hover || x.rating;
  return (
    <li className={cx("rounded-[24px] bg-surface p-5 transition-opacity md:p-6", !x.on && "opacity-70")} aria-labelledby={headId}>
      <div className="flex items-center gap-4">
        <span className="relative h-[84px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-well">
          {it.image ? <Image src={it.image} alt="" fill sizes="68px" className="object-cover" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headId} className="text-[16px] font-semibold leading-snug">
            {it.title}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{t(R.colourSize, { color: it.color, size: it.size })}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ on: !x.on })}
          aria-pressed={!x.on}
          className="tap h-10 shrink-0 rounded-full px-3 text-[13px] font-semibold text-muted underline-offset-4 transition hover:text-ink hover:underline"
        >
          {x.on ? R.skip : R.include}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {x.on ? (
          <motion.div
            key="fields"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-4 pt-5">
              <fieldset>
                <legend className="mb-1.5 text-[14px] font-medium">{R.rateIt}</legend>
                <div className="flex gap-1" role="radiogroup" aria-label={t(T.formLabel, { title: it.title })} onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      id={`${k}-star-${n}`}
                      type="button"
                      role="radio"
                      aria-checked={x.rating === n}
                      aria-label={plural(T.stars, n)}
                      onMouseEnter={() => setHover(n)}
                      onClick={() => onChange({ rating: n })}
                      className="tap grid size-11 place-items-center rounded-full transition-[background-color,transform] hover:bg-surface-2 active:scale-90"
                    >
                      <Icon name="star" size={28} filled strokeWidth={0} className={cx("transition-colors", n <= shown ? "text-ink" : "text-ink/15")} />
                    </button>
                  ))}
                </div>
                {errors[`${k}-rating`] ? (
                  <p className="mt-1.5 text-[13px] font-medium text-sale" role="alert">
                    {errors[`${k}-rating`]}
                  </p>
                ) : null}
              </fieldset>

              <Field id={`${k}-title`} label={T.reviewTitle} optional maxLength={120} placeholder={T.titlePh} value={x.title} onChange={(e) => onChange({ title: e.target.value })} />
              <div>
                <label htmlFor={`${k}-body`} className="mb-1.5 block text-[14px] font-medium">
                  {T.yourReview}
                </label>
                <textarea
                  id={`${k}-body`}
                  rows={4}
                  maxLength={2000}
                  dir="auto"
                  value={x.body}
                  onChange={(e) => onChange({ body: e.target.value })}
                  aria-invalid={!!errors[`${k}-body`]}
                  aria-describedby={errors[`${k}-body`] ? `${k}-body-err` : undefined}
                  placeholder={T.reviewPh}
                  className="w-full resize-y rounded-2xl bg-surface p-4 text-[16px] ring-1 ring-ink/15 outline-none transition-[box-shadow] placeholder:text-muted/70 hover:ring-ink/30 focus:ring-2 focus:ring-ink aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-sale"
                />
                {errors[`${k}-body`] ? (
                  <p id={`${k}-body-err`} role="alert" className="mt-1.5 text-[13px] font-medium text-sale">
                    {errors[`${k}-body`]}
                  </p>
                ) : null}
              </div>

              {it.apparel ? (
                <fieldset>
                  <legend className="mb-1.5 text-[14px] font-medium">{R.fitOptional}</legend>
                  <div className="grid h-[52px] grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup">
                    {(["small", "true", "large"] as FitTendency[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={x.fit === f}
                        onClick={() => onChange({ fit: x.fit === f ? null : f })}
                        className={cx("tap rounded-xl text-[13px] font-semibold transition-colors", x.fit === f ? "bg-ink text-white" : "text-ink-2 hover:bg-surface")}
                      >
                        {f === "true" ? T.fitShortTrue : f === "small" ? T.fitShortSmall : T.fitShortLarge}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <PhotoPicker id={`${k}-photos`} files={x.photos} onChange={(photos) => onChange({ photos })} error={errors[`${k}-photos`]} />
            </div>
          </motion.div>
        ) : (
          <p key="skipped" className="sr-only" role="status">
            {R.skipped}
          </p>
        )}
      </AnimatePresence>
    </li>
  );
}
