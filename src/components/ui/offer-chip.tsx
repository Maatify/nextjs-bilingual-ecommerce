import { cx } from "@/lib/format";
import type { Locale } from "@/lib/types";
import { multiBuy } from "@/lib/pricing";

/**
 * Solid red discount chip (reference style): small-radius rectangle, white bold text.
 * Latin copy is uppercase + letter-spaced ("25% OFF"); Arabic ("خصم 25%") is never uppercased or spaced.
 */
/** `wrap`: let a long label break onto two lines (product cards on 2-column phone grids) instead of `whitespace-nowrap`. */
export function OfferChip({ children, className, size = "sm", wrap = false }: { children: React.ReactNode; className?: string; size?: "xs" | "sm"; wrap?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[4px] bg-sale font-bold uppercase tracking-[0.08em] text-white",
        wrap ? "leading-tight" : "whitespace-nowrap leading-none",
        size === "xs" ? "px-1.5 py-[3px] text-[12px]" : "px-2 py-1 text-[12px]",
        className,
      )}
    >
      {/* keep "20%" reading left-to-right inside Arabic copy. One wrapping span: as direct children of the inline-flex chip, the
          text runs and the <bdi> became separate flex items and the spaces between them collapsed ("16%OFF", "خصم20%على قطعتين") */}
      {typeof children === "string" ? <span>{children.split(/(\d+%)/).map((part, i) => (/^\d+%$/.test(part) ? <bdi key={i} dir="ltr">{part}</bdi> : part))}</span> : children}
    </span>
  );
}

/** "25% OFF" / "خصم 25%" — the number then the percentage. */
export const pctOffLabel = (pct: number, locale: Locale) => (locale === "ar" ? `خصم ${pct}%` : `${pct}% OFF`);

/** Summary row label for the multi-buy saving: "20% off · 2 pieces" / "خصم 20% على قطعتين". */
export function multiBuyRowLabel(locale: Locale) {
  const m = multiBuy();
  if (!m) return "";
  if (locale === "ar") return `خصم ${m.pct}% على ${m.qty === 2 ? "قطعتين" : `${m.qty} ${m.qty > 10 ? "قطعة" : "قطع"}`}`;
  return `${m.pct}% off · ${m.qty} pieces`;
}
