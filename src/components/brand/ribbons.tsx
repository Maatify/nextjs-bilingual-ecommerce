import { getContent } from "@/lib/data";
import { cx } from "@/lib/format";

function Band({ items, reverse, className }: { items: string[]; reverse?: boolean; className?: string }) {
  // two identical halves → translateX(-50%) loops seamlessly (+50% in RTL: the keyframes read --mq-dir, so Arabic tapes run mirrored)
  const half = [...items, ...items];
  return (
    <div className={cx("absolute inset-s-[-6%] w-[112%] overflow-hidden py-2.5 md:py-3.5", className)}>
      <div className={cx("flex w-max", reverse ? "animate-ribbon-rev" : "animate-ribbon")}>
        {[0, 1].map((k) => (
          <ul key={k} className="flex shrink-0 items-center" aria-hidden={k === 1 || undefined}>
            {half.map((t, i) => (
              <li key={i} className="flex items-center gap-4 pe-4 font-poster text-[17px] leading-none md:gap-6 md:pe-6 md:text-[26px]">
                <span aria-hidden className="text-[0.9em]">
                  ✱
                </span>
                {t}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/**
 * Two crossed marquee tapes (Threadnova / Vestra pattern). Purely decorative —
 * the copy is repeated for screen readers once via the sr-only list. In Arabic the tilt and travel mirror.
 * Pass localized copy (callers use localizeContent); the default is the English admin copy.
 */
export function Ribbons({
  a: aProp,
  b: bProp,
  tone = "dark",
  className,
}: {
  /** defaults to the ribbon copy in /admin → Content */
  a?: string[];
  b?: string[];
  tone?: "dark" | "light";
  className?: string;
}) {
  const a = aProp ?? getContent().ribbons.a;
  const b = bProp ?? getContent().ribbons.b;
  if (!a.length && !b.length) return null;
  return (
    <div className={cx("relative h-[112px] overflow-x-clip md:h-[168px]", className)}>
      <p className="sr-only">{[...a, ...b].join(" · ")}</p>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Band items={b} reverse className={cx("top-1/2 -translate-y-1/2 rotate-[2.5deg] rtl:-rotate-[2.5deg]", tone === "dark" ? "bg-sage text-ink" : "bg-white text-ink")} />
        <Band items={a} className={cx("top-1/2 -translate-y-1/2 -rotate-[3.5deg] shadow-lift rtl:rotate-[3.5deg]", tone === "dark" ? "bg-ink text-white" : "bg-forest text-white")} />
      </div>
    </div>
  );
}
