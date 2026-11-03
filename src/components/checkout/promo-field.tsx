"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";
import { checkPromo } from "@/lib/pricing";
import { getPromoCodes, unlockPromo } from "@/lib/site";
import type { PromoCode } from "@/lib/types";
import { actions, useStore } from "@/lib/store";

/** Discount code input — validates against the live promo codes (incl. minimum subtotal) and writes to the shared store. */
export function PromoField({ discount, merch, className }: { discount: number; /** merchandise subtotal after Buy-N-Get-M, for minimum-spend codes */ merch?: number; className?: string }) {
  const promo = useStore((s) => s.promo);
  const { d, money, locale } = useI18n();
  const P = d.checkout.promo;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  // a personal code (review reward) applied earlier isn't in the public snapshot — re-confirm it with the server once
  useEffect(() => {
    if (!promo || getPromoCodes()[promo.toUpperCase()]) return;
    let live = true;
    fetchPrivate(promo).then((ok) => {
      if (!ok || !live) return;
      actions.setPromo(null);
      queueMicrotask(() => actions.setPromo(promo));
    });
    return () => {
      live = false;
    };
  }, [promo]);

  if (promo) {
    const check = checkPromo(promo, merch ?? Infinity, locale);
    const code = check.code;
    return (
      <div className={cx("flex items-center gap-3 rounded-2xl px-4 py-3", check.error ? "bg-sale/10" : "bg-sage-soft", className)} role="status">
        <Icon name={check.error ? "info" : "tag"} size={18} className={check.error ? "text-sale" : "text-forest"} />
        <span className="min-w-0 flex-1 text-[13px]">
          <bdi dir="ltr" className="font-bold tracking-wide">{promo.toUpperCase()}</bdi>
          <span className="block text-ink-2">
            {check.error ?? code?.label}
            {discount ? ` · −${money(discount)}` : ""}
          </span>
        </span>
        <button type="button" onClick={() => actions.setPromo(null)} className="tap text-[13px] font-semibold underline underline-offset-4">
          {P.remove}
        </button>
      </div>
    );
  }

  const apply = () => {
    const code = value.trim().toUpperCase();
    if (!code) return setError(P.enter);
    setBusy(true);
    // short delay mirrors a real server check and makes the state change legible
    const known = !!getPromoCodes()[code];
    Promise.all([known || fetchPrivate(code), new Promise((r) => setTimeout(r, 450))]).then(() => {
      setBusy(false);
      if (!getPromoCodes()[code]) return setError(checkPromo(code, 0, locale).error ?? P.enter);
      const check = checkPromo(code, merch ?? Infinity, locale);
      if (check.error) return setError(check.error);
      setError(null);
      setValue("");
      actions.setPromo(code);
    });
  };

  return (
    <div className={className}>
      <div className={cx("flex h-14 items-center gap-2 rounded-full bg-surface p-1.5 ps-5 ring-1 transition has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-forest", error ? "ring-sale" : "ring-line")}>
        <label htmlFor={id} className="sr-only">
          {P.label}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder={P.placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={!!error}
          aria-describedby={`${id}-msg`}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] uppercase outline-none placeholder:normal-case placeholder:text-muted"
        />
        <button
          type="button"
          onClick={apply}
          disabled={busy}
          className="tap h-full shrink-0 rounded-full bg-ink px-5 text-[14px] font-semibold text-white transition hover:bg-forest active:scale-95 disabled:opacity-60"
        >
          {busy ? P.checking : P.apply}
        </button>
      </div>
      <p id={`${id}-msg`} className={cx("mt-1.5 min-h-4 ps-5 text-[12px]", error ? "text-sale" : "text-muted")} aria-live="polite">
        {error ? (
          <span className="inline-flex items-center gap-1">
            <Icon name="info" size={13} /> {error}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** Ask the server about a personal (private) code; unlocks it locally when valid. */
async function fetchPrivate(code: string): Promise<boolean> {
  try {
    const res = await fetch("/api/promo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) return false;
    const json = (await res.json()) as { code?: PromoCode };
    if (!json.code) return false;
    unlockPromo(json.code);
    return true;
  } catch {
    return false;
  }
}
