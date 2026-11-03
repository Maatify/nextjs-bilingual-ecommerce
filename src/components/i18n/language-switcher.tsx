"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cx } from "@/lib/format";
import { LANG_COOKIE, localeHref, stripLocale, type Locale } from "@/lib/i18n/store/config";
import { useI18n } from "./provider";

function remember(l: Locale) {
  try {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  } catch {}
}

function Switch({ className, tone = "dark", variant = "pill", search }: Props & { search: string }) {
  const { locale, d } = useI18n();
  const pathname = usePathname() || "/";
  const target: Locale = locale === "ar" ? "en" : "ar";
  const { path } = stripLocale(pathname);
  const href = localeHref(target, path) + search;
  const label = d.common.language.switchTo;

  // A plain <a> (full load): the new <html lang dir>, fonts and dictionary all switch together.
  return (
    <a
      href={href}
      hrefLang={target}
      lang={target}
      onClick={() => remember(target)}
      title={label}
      className={cx(
        "tap inline-flex select-none items-center justify-center font-semibold transition",
        // 36px pill, 44px hit area (::after) — WCAG 2.5.5 target size without changing the header look
        variant === "pill" && "relative h-9 min-w-9 rounded-full px-2.5 text-[13px] ring-1 ring-inset after:absolute after:-inset-1 after:content-['']",
        variant === "pill" && (tone === "dark" ? "ring-ink/12 hover:bg-ink hover:text-white hover:ring-ink" : "ring-white/25 text-white hover:bg-white hover:text-ink"),
        variant === "row" && "h-12 gap-2 rounded-2xl bg-surface-2 px-4 text-[14px]",
        className,
      )}
    >
      {variant === "row" ? (
        <>
          <span aria-hidden className="text-muted">
            {d.common.language.label}
          </span>
          <span>{target === "ar" ? d.common.language.ar : d.common.language.en}</span>
        </>
      ) : (
        <>
          {/* visible "EN" / "ع" first, then the full phrase for screen readers — the accessible name contains the visible label (WCAG 2.5.3) */}
          <span className={target === "ar" ? "font-arabic text-[15px] leading-none" : "leading-none"}>{d.common.language.short[target]}</span>
          <span className="sr-only"> {label}</span>
        </>
      )}
    </a>
  );
}

function WithSearch(props: Props) {
  const sp = useSearchParams();
  const q = sp.toString();
  return <Switch {...props} search={q ? `?${q}` : ""} />;
}

type Props = { className?: string; tone?: "dark" | "light"; variant?: "pill" | "row" };

/** EN / ع toggle — keeps the current page (and its query string), remembers the choice in a cookie. */
export function LanguageSwitcher(props: Props) {
  return (
    <Suspense fallback={<Switch {...props} search="" />}>
      <WithSearch {...props} />
    </Suspense>
  );
}
