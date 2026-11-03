"use client";

import { useI18n } from "@/components/i18n/provider";
import { Accordion } from "@/components/ui/primitives";
import { descriptionHtml } from "@/lib/rich-text";
import { getOffer } from "@/lib/site";
import type { Product } from "@/lib/types";
import { fitLabel } from "./fit";

function Lines({ items }: { items: (string | null | undefined | false)[] }) {
  return (
    <ul className="space-y-1.5">
      {items.filter(Boolean).map((t) => (
        <li key={t as string} className="flex gap-2.5">
          <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-ink/40" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Collapsed details: three accordions, short bullet lines only. */
export function ProductDetails({ product: base }: { product: Product }) {
  const L = useI18n();
  const { d, t, money, product } = L;
  const T = d.product.details;
  const p = product(base);
  // sanitized on save AND here (strict allowlist); legacy plain text becomes escaped paragraphs
  const html = descriptionHtml(p.description);
  return (
    <div id="details" className="scroll-mt-24 border-t border-line">
      {html ? (
        <Accordion title={T.description} defaultOpen>
          <div
            className="rte space-y-3 [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-1 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ps-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:ps-5 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Accordion>
      ) : null}
      <Accordion title={T.fabric}>
        <Lines items={[`${p.gsm ? `${p.gsm} GSM · ` : ""}${p.material}`, fitLabel(p, L), ...p.highlights, p.modelInfo]} />
      </Accordion>
      <Accordion title={T.care}>
        <Lines items={[...p.care, T.coloursVary]} />
      </Accordion>
      <Accordion title={T.shipping}>
        <Lines items={[T.shipCod, T.shipExchange, T.shipTimes, t(T.shipFree, { price: money(getOffer().freeShippingAt) })]} />
      </Accordion>
    </div>
  );
}
