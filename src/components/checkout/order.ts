"use client";

import { useMemo, useSyncExternalStore } from "react";
import { addBusinessDays } from "@/lib/format";
import { getOffer } from "@/lib/site";

export type { PaymentMethod } from "@/lib/checkout";
import type { PaymentMethod } from "@/lib/checkout";

export interface OrderSnapshot {
  number: string;
  createdAt: string;
  name: string;
  phone: string;
  email?: string;
  whatsappUpdates: boolean;
  address: { governorate: string; city: string; street: string; building: string; landmark?: string; notes?: string };
  shipping: "standard" | "express";
  payment: PaymentMethod;
  eta: [string, string];
  lines: { key: string; productId: string; handle: string; title: string; color: string; size: string; qty: number; image: string; total: number; free: number }[];
  bump?: { title: string; price: number } | null;
  totals: {
    itemCount: number;
    subtotal: number;
    bogoDiscount: number;
    /** multi-buy (e.g. 2 pieces → 20% off); absent on orders placed before the offer existed */
    multiDiscount?: number;
    promoDiscount: number;
    prepaidDiscount: number;
    shipping: number;
    protection: number;
    bump: number;
    total: number;
    totalSavings: number;
    gift: boolean;
  };
}

export const ORDER_KEY = "verda:lastOrder";

/** Delivery window: same-day dispatch before the cut-off, then the governorate's transit days. */
export function deliveryWindow(days: [number, number], express: boolean, now = new Date()) {
  const dispatch = now.getHours() < getOffer().cutoffHour ? 0 : 1;
  if (express) {
    const d = addBusinessDays(now, 1 + dispatch);
    return [d, d] as const;
  }
  return [addBusinessDays(now, days[0] + dispatch), addBusinessDays(now, days[1] + dispatch)] as const;
}

const noop = () => () => {};

/** Reads the last order from sessionStorage without a hydration mismatch. */
export function useLastOrder(): { ready: boolean; order: OrderSnapshot | null } {
  const raw = useSyncExternalStore(
    noop,
    () => {
      try {
        return sessionStorage.getItem(ORDER_KEY) ?? "";
      } catch {
        return "";
      }
    },
    () => null,
  );
  return useMemo(() => {
    if (raw === null) return { ready: false, order: null };
    try {
      return { ready: true, order: raw ? (JSON.parse(raw) as OrderSnapshot) : null };
    } catch {
      return { ready: true, order: null };
    }
  }, [raw]);
}
