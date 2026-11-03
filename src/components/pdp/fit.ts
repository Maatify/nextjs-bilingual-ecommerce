import type { I18n } from "@/lib/i18n/store/kit";
import type { Product } from "@/lib/types";

/** Short fit subtitle shown under the title (MAVIN-style "Slim Fit"). */
export function fitLabel(p: Product, { d, category }: Pick<I18n, "d" | "category">) {
  if (p.sizeChart === "onesize") return category(p);
  if (p.fit === "large") return d.product.fit.relaxed;
  if (p.fit === "small") return d.product.fit.slim;
  return d.product.fit.regular;
}

/** One-line, actionable fit note derived from review fit feedback. */
export function fitNote(p: Product, { d }: Pick<I18n, "d">) {
  if (p.sizeChart === "onesize") return null;
  const f = d.product.fit;
  if (p.fit === "small") return { text: f.smallText, action: f.smallAction };
  if (p.fit === "large") return { text: f.largeText, action: f.largeAction };
  return { text: f.trueText, action: f.trueAction };
}
