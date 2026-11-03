import Link from "@/components/i18n/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { getProductById, getProducts } from "@/lib/catalog";
import { snapshot } from "@/lib/data";
import { cx } from "@/lib/format";

/** First photo of a product in a named colour (falls back to the first colour). */
export function photo(productId: string, color: string, n = 0) {
  const p = getProductById(productId);
  const c = p?.colors.find((x) => x.name === color) ?? p?.colors[0];
  return c?.images[n] ?? c?.images[0] ?? "";
}

/** Store-wide rating from REAL published reviews only (count 0 → callers hide rating claims). */
export function getStoreRating() {
  const live = new Set(getProducts().map((p) => p.id));
  const reviews = snapshot().reviews.filter((r) => r.status === "published" && live.has(r.productId));
  const count = reviews.length;
  const avg = count ? reviews.reduce((n, r) => n + r.rating, 0) / count : 0;
  return { avg: Math.round(avg * 10) / 10, count };
}

/** Linea "● label" pill. */
export function Dot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-7 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[12px] font-medium", className)}>
      <span className="size-1.5 rounded-full bg-sale" aria-hidden />
      {children}
    </span>
  );
}

/** Threadnova poster heading with an optional quiet "↗" link on the right. */
export function PosterHeading({ id, children, href, cta }: { id: string; children: ReactNode; href?: string; cta?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 md:mb-10">
      <h2 id={id} className="text-poster">
        {children}
      </h2>
      {href ? (
        <Link href={href} className="tap -mb-1 inline-flex h-11 shrink-0 items-center gap-1 text-[14px] font-semibold underline-offset-4 hover:underline">
          {cta} <Icon name="arrowUpRight" size={16} />
        </Link>
      ) : null}
    </div>
  );
}
