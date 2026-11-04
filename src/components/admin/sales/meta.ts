import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import type { AIconName } from "../icons";
import type { Tone } from "../ui";

/* Order status / payment metadata shared by server pages and client views (no "use client"). */

export const FLOW: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"];
export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone; icon: AIconName }> = {
  draft: { label: "Draft", tone: "neutral", icon: "edit" },
  pending: { label: "Pending", tone: "amber", icon: "bell" },
  confirmed: { label: "Confirmed", tone: "blue", icon: "check" },
  packed: { label: "Packed", tone: "violet", icon: "inventory" },
  shipped: { label: "Shipped", tone: "pink", icon: "truck" },
  delivered: { label: "Delivered", tone: "green", icon: "check" },
  cancelled: { label: "Cancelled", tone: "red", icon: "close" },
  returned: { label: "Returned", tone: "neutral", icon: "refresh" },
};

/** The single forward action for each status in the fulfilment flow. */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: AIconName }>> = {
  pending: { to: "confirmed", label: "Confirm order", icon: "check" },
  confirmed: { to: "packed", label: "Mark as packed", icon: "inventory" },
  packed: { to: "shipped", label: "Mark as shipped", icon: "truck" },
  shipped: { to: "delivered", label: "Mark delivered", icon: "check" },
};

export const BULK_STEPS: { to: "confirmed" | "packed" | "shipped" | "delivered"; label: string; icon: AIconName }[] = [
  { to: "confirmed", label: "Confirm", icon: "check" },
  { to: "packed", label: "Pack", icon: "inventory" },
  { to: "shipped", label: "Ship", icon: "truck" },
  { to: "delivered", label: "Deliver", icon: "check" },
];

export const PAYMENT_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const METHOD_META: Record<Order["paymentMethod"], { label: string; icon: AIconName }> = {
  cod: { label: "Cash on delivery", icon: "cash" },
  card: { label: "Card", icon: "card" },
  wallet: { label: "Wallet", icon: "phone" },
  installments: { label: "Installments", icon: "calendar" },
};
export const isFinal = (s: OrderStatus) => s === "cancelled" || s === "returned";

/** Forward moves along FLOW only (never out of cancelled/returned). */
export const canAdvance = (from: OrderStatus, to: OrderStatus) => !isFinal(from) && FLOW.indexOf(to) > FLOW.indexOf(from);
export const canCancel = (s: OrderStatus) => s === "pending" || s === "confirmed" || s === "packed" || s === "shipped";
export const canReturn = (s: OrderStatus) => s === "shipped" || s === "delivered";

/** Egyptian mobile → international wa.me format (01xxxxxxxxx → 201xxxxxxxxx). */
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("20")) return d;
  if (d.startsWith("0")) return `2${d}`;
  return d;
}

/** Locale-aware full date (pass `fmt` from useT()/getT()). */
export const fmtDate = (fmt: { date: (d: string, o?: Intl.DateTimeFormatOptions) => string }, iso: string, withTime = true) =>
  fmt.date(iso, { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
