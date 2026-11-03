import { snapshot } from "./data";
import type { Governorate } from "./types";

/** Governorates with courier rate (EGP) and business-day window — edited in /admin → Settings → Shipping. */
export const getGovernorates = (): Governorate[] => snapshot().settings.governorates.filter((g) => g.enabled !== false);

/** Egyptian mobile: 010/011/012/015 + 8 digits, optional +20 prefix. */
export function normalizeEgPhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^20/, "0");
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}
