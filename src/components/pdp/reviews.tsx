"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type FormEvent } from "react";
import { Field, SelectField } from "@/components/checkout/fields";
import { useI18n } from "@/components/i18n/provider";
import { PhotoPicker } from "@/components/reviews/photo-picker";
import { ReviewPhotos } from "@/components/reviews/review-photos";
import { Icon } from "@/components/ui/icon";
import { Button, Stars } from "@/components/ui/primitives";
import { normalizeEgPhone } from "@/lib/egypt";
import { langHeaders } from "@/lib/i18n/store/api";
import { cx } from "@/lib/format";
import type { FitTendency, Product, Review } from "@/lib/types";

type I18n = ReturnType<typeof useI18n>;
const fitLabelOf = (T: I18n["d"]["product"]["reviews"], f: FitTendency) => (f === "small" ? T.fitSmall : f === "large" ? T.fitLarge : T.fitTrue);
/** English sentence-case inside a sentence ("runs small"); Arabic has no case. */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

type ShownReview = Review & { reply?: string };
type ReviewsT = I18n["d"]["product"]["reviews"];
const viaLabel = (T: ReviewsT, s: Review["source"]) => (s && s !== "other" ? T.via[s] : "");

/** Fit scale (Runs small → Runs large). The marker and percentages only appear once real reviewers have weighed in. */
export function FitBar({ product: p }: { product: Product }) {
  const { d, t } = useI18n();
  const T = d.product.reviews;
  const [small, , large] = p.fitSplit;
  // only reviews that said how it fits count — imported reviews often don't
  const real = (p.fitReviews ?? 0) > 0;
  const pos = real ? 50 + (large - small) * 0.9 : p.fit === "small" ? 22 : p.fit === "large" ? 78 : 50;
  return (
    <div>
      <p className="mb-3 text-[14px] font-semibold">{T.howFits}</p>
      <div className="relative h-2 rounded-full bg-surface-2">
        <div className="absolute inset-y-0 inset-s-1/3 inset-e-1/3 rounded-full bg-sage-soft" />
        <span
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-forest shadow-soft rtl:translate-x-1/2"
          style={{ insetInlineStart: `${Math.max(6, Math.min(94, pos))}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2.5 flex justify-between text-[12px] text-muted">
        <span>{T.fitSmall}</span>
        <span className="font-semibold text-ink">{T.fitTrue}</span>
        <span>{T.fitLarge}</span>
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {real ? t(T.stats, { t: p.fitSplit[1], s: small, l: large }) : t(T.fitNote, { fit: lower(fitLabelOf(T, p.fit)) })}
      </p>
    </div>
  );
}

/** Summary (rating, distribution, fit) + reviews, "Show more" reveals the rest, and a real "Write a review" form. */
export function Reviews({ product: base, reviews, breakdown }: { product: Product; reviews: ShownReview[]; breakdown: number[] }) {
  const L = useI18n();
  const { d, t, p: plural, product } = L;
  const T = d.product.reviews;
  const p = product(base);
  const [shown, setShown] = useState(3);
  const [writing, setWriting] = useState(false);
  const apparel = p.sizeChart !== "onesize";
  const list = useMemo(() => [...reviews].sort((a, b) => b.date.localeCompare(a.date)), [reviews]);
  const has = p.reviewCount > 0;

  return (
    <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="reviews-h" className="text-poster">
          {T.title}
        </h2>
        {!writing && has ? (
          <Button variant="outline" onClick={() => setWriting(true)} aria-expanded={writing} aria-controls="write-review">
            <Icon name="star" size={16} /> {T.write}
          </Button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {writing ? (
          <motion.div
            key="form"
            id="write-review"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <WriteReview product={p} onClose={() => setWriting(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {has ? (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 md:mt-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">
          <div className="rounded-[24px] bg-surface p-5 md:p-8 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
            <div className="flex items-end gap-3">
              <span className="font-poster text-[64px] leading-[0.85] tabular-nums">{p.rating.toFixed(1)}</span>
              <div>
                <Stars rating={p.rating} size={15} />
                <p className="mt-1 text-[13px] text-muted tabular-nums">
                  {plural(d.common.reviews, p.reviewCount)}
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-1.5" aria-label={T.distribution}>
              {[5, 4, 3, 2, 1].map((star, i) => (
                <li key={star} className="flex items-center gap-3 text-[12px]">
                  <span className="w-7 font-semibold tabular-nums">
                    <bdi dir="ltr">{star} ★</bdi>
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${breakdown[i]}%` }} />
                  </span>
                  <span className="w-9 text-end text-muted tabular-nums">{breakdown[i]}%</span>
                </li>
              ))}
            </ul>
            {apparel ? (
              <div className="mt-6 border-t border-line pt-5">
                <FitBar product={p} />
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <ul className="space-y-3">
              {list.slice(0, shown).map((r) => (
                <ReviewCard key={r.id} r={r} apparel={apparel} L={L} />
              ))}
            </ul>
            <p className="sr-only" aria-live="polite">
              {t(T.showing, { n: Math.min(shown, list.length), total: list.length })}
            </p>
            {shown < list.length ? (
              <button
                type="button"
                onClick={() => setShown((n) => n + 6)}
                className="tap mt-4 flex h-12 w-full items-center justify-center rounded-full bg-surface text-[14px] font-semibold ring-1 ring-inset ring-ink/10 transition hover:ring-ink/40 active:scale-[0.99]"
              >
                {T.more}
              </button>
            ) : null}
          </div>
        </div>
      ) : !writing ? (
        <div className="mt-6 flex flex-col items-start gap-5 rounded-[24px] bg-surface p-5 sm:flex-row sm:items-center md:mt-10 md:p-8">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-sage-soft text-forest" aria-hidden>
            <Icon name="star" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold">{T.firstTitle}</p>
            <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-muted">{t(T.firstBody, { title: p.title })}</p>
            {apparel ? <p className="mt-2 text-[13px] text-muted">{t(T.fitNoteShort, { fit: lower(fitLabelOf(T, p.fit)) })}</p> : null}
          </div>
          <Button onClick={() => setWriting(true)} aria-expanded={writing} aria-controls="write-review" className="shrink-0">
            {T.firstCta}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ReviewCard({ r, apparel, L }: { r: ShownReview; apparel: boolean; L: I18n }) {
  const { d, t } = L;
  const T = d.product.reviews;
  const date = L.date(r.date.slice(0, 10) + "T00:00:00Z", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const body = [r.height ? t(T.cm, { n: r.height }) : "", r.weight ? t(T.kg, { n: r.weight }) : "", r.size ? t(T.bought, { size: r.size }) : "", r.fit && !r.fitUnknown ? lower(fitLabelOf(T, r.fit)) : ""].filter(Boolean);
  const photos = r.photos?.length ? r.photos : r.photo ? [r.photo] : [];
  const via = viaLabel(T, r.source);
  return (
    <li className="rounded-[24px] bg-surface p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Stars rating={r.rating} size={13} />
        <span className="text-[12px] text-muted">{date}</span>
      </div>
      {r.title ? (
        <p className="mt-3 text-[16px] font-semibold" dir="auto">
          {r.title}
        </p>
      ) : null}
      <p className={cx("text-[15px] leading-relaxed text-ink-2", r.title ? "mt-1" : "mt-3")} dir="auto">
        {r.body}
      </p>
      {photos.length ? <ReviewPhotos photos={photos} name={r.author} size={72} className="mt-4" /> : null}
      <div className="mt-4 min-w-0 text-[13px] leading-snug">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold">
          <bdi>{r.author}</bdi>
          {r.verified ? (
            <span className="inline-flex items-center gap-1 font-medium text-forest">
              <Icon name="verified" size={14} /> {T.verified}
            </span>
          ) : null}
          {r.city ? <span className="font-normal text-muted">· {r.city}</span> : null}
          {via ? <span className="font-normal text-muted">· {via}</span> : null}
        </p>
        {apparel && body.length ? <p className="text-muted tabular-nums">{body.join(" · ")}</p> : null}
        {r.incentivized ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-muted">
            <Icon name="gift" size={13} /> {T.incentivized}
          </p>
        ) : null}
      </div>
      {r.reply ? (
        <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-[14px] leading-relaxed">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{T.reply}</p>
          <p className="text-ink-2">{r.reply}</p>
        </div>
      ) : null}
    </li>
  );
}

/* ───────────────────────── write a review ───────────────────────── */

function WriteReview({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const { d: dict, t, p: plural, locale } = useI18n();
  const T = dict.product.reviews;
  const apparel = p.sizeChart !== "onesize";
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState<FitTendency>("true");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [serverError, setServerError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const errs: Record<string, string> = {};
    if (!rating) errs["rv-rating"] = T.ratingErr;
    if (v("rv-body").length < 10) errs["rv-body"] = T.bodyErr;
    if (v("rv-name").length < 2) errs["rv-name"] = T.nameErr;
    if (v("rv-phone") && !normalizeEgPhone(v("rv-phone"))) errs["rv-phone"] = T.phoneErr;
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) return document.getElementById(first === "rv-rating" ? "rv-star-1" : first)?.focus();
    setState("sending");
    setServerError("");
    try {
      // multipart so up to 3 photos travel with the text (the server re-encodes them)
      const body = new FormData();
      const fields: Record<string, string> = { productId: p.id, rating: String(rating), title: v("rv-title"), body: v("rv-body"), name: v("rv-name"), city: v("rv-city"), size: v("rv-size"), fit, phone: v("rv-phone"), website: v("rv-website") };
      for (const [k, val] of Object.entries(fields)) body.append(k, val);
      for (const f of photos) body.append("photos", f);
      const res = await fetch("/api/reviews", { method: "POST", headers: langHeaders(locale), body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || T.sendErr);
      setState("sent");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : T.sendErr);
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-[24px] bg-surface p-5 md:p-8" role="status">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white">
          <Icon name="check" size={20} />
        </span>
        <div className="flex-1">
          <p className="font-semibold">{T.sentTitle}</p>
          <p className="text-[14px] text-ink-2">{T.sentBody}</p>
        </div>
        <button type="button" onClick={onClose} className="tap grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label={T.close}>
          <Icon name="close" size={18} />
        </button>
      </div>
    );
  }

  const shownStars = hover || rating;
  return (
    <form onSubmit={submit} noValidate className="relative mt-6 grid gap-4 rounded-[24px] bg-surface p-5 sm:grid-cols-2 md:p-8" aria-label={t(T.formLabel, { title: p.title })}>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-[14px] font-medium">{T.yourRating}</legend>
        <div className="flex gap-1" role="radiogroup" aria-label={T.starRating} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button
              key={n}
              id={`rv-star-${n}`}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={plural(T.stars, n)}
              whileTap={{ scale: 0.85 }}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="tap grid size-11 place-items-center rounded-full transition-colors hover:bg-surface-2"
            >
              <Icon name="star" size={26} filled strokeWidth={0} className={cx("transition-colors", n <= shownStars ? "text-ink" : "text-ink/15")} />
            </motion.button>
          ))}
        </div>
        {errors["rv-rating"] ? (
          <p className="mt-1.5 text-[13px] font-medium text-sale" role="alert">
            {errors["rv-rating"]}
          </p>
        ) : null}
      </fieldset>

      <Field id="rv-title" label={T.reviewTitle} optional maxLength={120} className="sm:col-span-2" placeholder={T.titlePh} />
      <div className="sm:col-span-2">
        <label htmlFor="rv-body" className="mb-1.5 block text-[14px] font-medium">
          {T.yourReview}
        </label>
        <textarea
          id="rv-body"
          name="rv-body"
          rows={4}
          maxLength={2000}
          aria-invalid={!!errors["rv-body"]}
          aria-describedby={errors["rv-body"] ? "rv-body-err" : undefined}
          placeholder={T.reviewPh}
          className="w-full resize-y rounded-2xl bg-surface p-4 text-[16px] ring-1 ring-ink/15 outline-none transition placeholder:text-muted/70 hover:ring-ink/30 focus:ring-2 focus:ring-ink aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-sale"
        />
        {errors["rv-body"] ? (
          <p id="rv-body-err" role="alert" className="mt-1.5 text-[13px] font-medium text-sale">
            {errors["rv-body"]}
          </p>
        ) : null}
      </div>
      <Field id="rv-name" label={T.name} autoComplete="given-name" maxLength={60} error={errors["rv-name"]} hint={T.nameHint} />
      <Field id="rv-city" label={T.city} optional autoComplete="address-level2" maxLength={60} />
      {apparel ? (
        <>
          <SelectField id="rv-size" label={T.sizeBought} defaultValue="">
            <option value="">—</option>
            {p.sizes.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </SelectField>
          <fieldset>
            <legend className="mb-1.5 text-[14px] font-medium">{T.fitQ}</legend>
            <div className="grid h-[52px] grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup">
              {(["small", "true", "large"] as FitTendency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={fit === f}
                  onClick={() => setFit(f)}
                  className={cx("tap rounded-xl text-[13px] font-semibold transition", fit === f ? "bg-ink text-white" : "text-ink-2 hover:bg-surface")}
                >
                  {f === "true" ? T.fitShortTrue : f === "small" ? T.fitShortSmall : T.fitShortLarge}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      <Field
        id="rv-phone"
        label={T.phone}
        dir="ltr"
        optional
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="010 1234 5678"
        error={errors["rv-phone"]}
        hint={T.phoneHint}
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <PhotoPicker id="rv-photos" files={photos} onChange={setPhotos} />
      </div>
      {/* honeypot — hidden from people, bots fill it */}
      <div aria-hidden className="absolute -inset-s-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="rv-website">Website</label>
        <input id="rv-website" name="rv-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {serverError ? (
        <p className="text-[14px] font-medium text-sale sm:col-span-2" role="alert">
          {serverError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={state === "sending"} disabled={state === "sending"}>
          {state === "sending" ? T.sending : T.submit}
        </Button>
        <button type="button" onClick={onClose} className="tap h-11 px-3 text-[14px] font-semibold text-muted underline underline-offset-4 hover:text-ink">
          {T.cancel}
        </button>
      </div>
    </form>
  );
}
