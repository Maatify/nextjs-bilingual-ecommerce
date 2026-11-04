import { formatMoney, intlLocale, type Locale } from "./i18n/store/config";

/** "EGP 1,590" — or "1,590 ج.م" with locale "ar" (storefront components use useI18n().money / getI18n().money). */
export const money = (n: number, locale: Locale = "en") => formatMoney(n, locale);

export const pctOff = (price: number, compareAt?: number) =>
  compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;
export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Add business days (Fri is the weekend day in Egypt for couriers). */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 5) added++;
  }
  return d;
}

export const shortDate = (d: Date, locale: Locale = "en") =>
  d.toLocaleDateString(intlLocale(locale), { weekday: "short", day: "numeric", month: "short" });