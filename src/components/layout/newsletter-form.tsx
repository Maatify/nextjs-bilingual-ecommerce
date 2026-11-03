"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";
import { getOffer, getPromoCodes } from "@/lib/site";

export function NewsletterForm({ tone = "dark", onDone, source = "newsletter" }: { tone?: "dark" | "light"; onDone?: () => void; source?: string }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // unique per instance: the footer and the welcome popup both render a light form at the same time
  const fid = `nl-${useId().replace(/[^\w-]/g, "")}`;
  const OFFER = getOffer();
  const { d, t, locale } = useI18n();
  const n = d.layout.newsletter;
  // only advertise the welcome code while it's an active promo code
  const welcome = getPromoCodes()[OFFER.welcomeCode?.toUpperCase()] ? OFFER.welcomeCode : null;

  return state === "done" ? (
    <div className={cx("mt-6 flex items-center gap-3 rounded-2xl p-4", tone === "dark" ? "bg-white/10" : "bg-surface-2")} role="status">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white">
        <Icon name="check" size={18} />
      </span>
      <span className="text-[14px]">
        {welcome ? (
          <>
            {n.doneCodeBefore}{" "}
            <b dir="ltr" className="ltr-run font-bold tracking-wide">
              {welcome}
            </b>{" "}
            {n.doneCodeAfter}
          </>
        ) : (
          n.done
        )}
      </span>
    </div>
  ) : (
    <form
      className="mt-6"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = /\S+@\S+\.\S+/.test(value) || /^(\+?20)?0?1[0125]\d{8}$/.test(value.replace(/\s/g, ""));
        if (!ok) {
          setError(n.invalid);
          return setState("error");
        }
        setState("loading");
        try {
          const res = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contact: value, source, locale, website: (document.getElementById(`${fid}-website`) as HTMLInputElement | null)?.value ?? "" }) });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            setError(j.error ?? n.failed);
            return setState("error");
          }
          setState("done");
          onDone?.();
        } catch {
          setError(n.offline);
          setState("error");
        }
      }}
    >
      {/* honeypot — hidden from people, bots fill it (same pattern as contact-form.tsx) */}
      <div aria-hidden className="absolute -inset-s-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${fid}-website`}>{d.checkout.contactForm.website}</label>
        <input id={`${fid}-website`} name={`${fid}-website`} type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {/* tapered field: tall at the start, narrowing toward the button (shape drawn by <TaperShape>). On narrow phones (and the
          welcome popup there) the label "Get 10% off" left no room to type, so the field and a full-width button stack instead */}
      <div className="@container">
      <div className="group relative flex h-[76px] items-center gap-2 py-2 pe-[5px] ps-7 @max-[19rem]:h-auto @max-[19rem]:flex-col @max-[19rem]:items-stretch @max-[19rem]:p-0">
        <TaperShape tone={tone} error={state === "error"} />
        <label htmlFor={fid} className="sr-only">
          {n.label}
        </label>
        <input
          id={fid}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state === "error") {
              setState("idle");
              setError(null);
            }
          }}
          placeholder={n.label}
          dir="auto"
          autoComplete="email"
          aria-invalid={state === "error"}
          aria-describedby={`${fid}-err`}
          className={cx(
            "relative h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:opacity-60",
            "@max-[19rem]:h-13 @max-[19rem]:flex-none @max-[19rem]:rounded-full @max-[19rem]:px-5 @max-[19rem]:ring-[1.5px]",
            tone === "dark" ? "@max-[19rem]:bg-white/8 @max-[19rem]:ring-white/15 @max-[19rem]:focus-visible:ring-white/60" : "@max-[19rem]:bg-surface-2 @max-[19rem]:ring-ink/10 @max-[19rem]:focus-visible:ring-ink",
            state === "error" && "@max-[19rem]:ring-sale",
          )}
        />
        <button
          disabled={state === "loading"}
          className={cx("tap relative h-11 shrink-0 rounded-full px-5 @max-[19rem]:h-12 text-[14px] font-semibold transition active:scale-95", tone === "dark" ? "bg-white text-ink hover:bg-surface-2" : "bg-ink text-white hover:bg-ink/85")}
        >
          {state === "loading" ? n.joining : welcome && OFFER.welcomePct ? t(n.getPct, { pct: OFFER.welcomePct }) : n.join}
        </button>
      </div>
      </div>
      <p id={`${fid}-err`} className={cx("mt-2 min-h-5 ps-5 text-[13px]", state === "error" ? "text-sale" : "opacity-0")} aria-live="polite">
        {state === "error" ? error : ""}
      </p>
    </form>
  );
}


/**
 * The field's background: a pill that is 76px tall at the start and tapers to 52px around the button,
 * with round caps at both ends. Drawn as an SVG sized to the real width (no distortion), mirrored in RTL.
 */
function TaperShape({ tone, error }: { tone: "dark" | "light"; error: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 76;
  const h = 52;
  const R = H / 2;
  const r = h / 2;
  const top = (H - h) / 2;
  const x1 = w - 1; // keep the stroke inside the box
  const d = w > R + r ? `M ${R} 1 L ${x1 - r} ${top} A ${r} ${r} 0 0 1 ${x1 - r} ${top + h} L ${R} ${H - 1} A ${R - 1} ${R - 1} 0 0 1 ${R} 1 Z` : "";
  return (
    <svg ref={ref} aria-hidden className="pointer-events-none absolute @max-[19rem]:hidden inset-0 h-full w-full overflow-visible rtl:-scale-x-100" viewBox={`0 0 ${w || 1} ${H}`} preserveAspectRatio="none">
      <path
        d={d}
        className={cx(
          "transition-[stroke,stroke-width] duration-200",
          tone === "dark" ? "fill-white/8 stroke-white/15 group-has-[input:focus-visible]:stroke-white/60" : "fill-surface-2 stroke-ink/10 group-has-[input:focus-visible]:stroke-ink",
          error && "stroke-sale",
        )}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
