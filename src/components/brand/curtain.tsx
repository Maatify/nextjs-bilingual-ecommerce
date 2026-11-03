import type { Locale } from "@/lib/types";

/**
 * Opening curtain — plays on every full page load (first visit / refresh), never on client navigations
 * (the storefront root layout doesn't remount). Pure CSS so it starts at first paint, before hydration:
 *
 *   0.00s  ink curtain covers the page; two full-width offer tapes cross behind the centre as an X and
 *          start scrolling; the VERDA wordmark rises in on top
 *   0.25s  a sage underline draws, the tagline fades up
 *   1.05s  the wordmark lifts away, then the curtain (straight edge, sage under-layer a beat behind)
 *          rolls UP off the screen, revealing the page
 *
 * Transform/opacity only. Reduced motion → a short fade. aria-hidden: purely decorative.
 */
export function Curtain({ name, locale, tapeA, tapeB }: { name: string; locale: Locale; tapeA: string[]; tapeB: string[] }) {
  const tagline = locale === "ar" ? "قطن تقيل · ألوان كتير" : "Heavyweight basics · every colour";
  // repeat the offers so each tape is always wider than the screen while it scrolls
  const row = (items: string[]) => Array.from({ length: 4 }, () => items).flat();
  return (
    <div aria-hidden className="vc-root">
      <div className="vc-under" />
      <div className="vc-curtain">
        <div className="vc-x">
          {[
            { cls: "vc-tape vc-tape-a", items: row(tapeA) },
            { cls: "vc-tape vc-tape-b", items: row(tapeB) },
          ].map((t) => (
            <div key={t.cls} className={t.cls}>
              <div className="vc-track">
                {t.items.map((s, i) => (
                  <span key={i} className="vc-item">
                    <span className="vc-star">✱</span>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="vc-mark">
          <span className="vc-word" dir="ltr">
            {name}
            <span className="vc-dot">.</span>
          </span>
          <span className="vc-line" />
          <span className="vc-tag">{tagline}</span>
        </div>
      </div>
    </div>
  );
}
