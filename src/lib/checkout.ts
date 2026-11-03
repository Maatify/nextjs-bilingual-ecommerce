import { getProductById, getUpsellId } from "./catalog";
import { getSettings } from "./data";
import { getGovernorates } from "./egypt";
import { computeTotals, type Totals } from "./pricing";
import { getOffer } from "./site";
import type { CartLine, Governorate, Order, Product } from "./types";

/*
 * Checkout pricing shared by the checkout form (client) and POST /api/orders (server),
 * so the shopper sees exactly what the server will charge. Reads live admin settings.
 */

export type PaymentMethod = Order["paymentMethod"];
export const PAYMENT_METHODS: PaymentMethod[] = ["cod", "card", "wallet", "installments"];

/**
 * Methods that can actually be completed. No online payment gateway is integrated yet, so only cash on delivery is
 * ready: card / wallet / installments stay off even when switched on in Settings, which keeps the checkout, the
 * order API and the prepaid discount from ever offering a payment nobody collects. Connecting a gateway means
 * handling its payment confirmation and then returning true here for the methods it covers.
 */
export function gatewayReady(method: PaymentMethod): boolean {
  return method === "cod";
}

/** Payment methods enabled in /admin → Settings → Payments that have a working flow (falls back to COD). */
export function enabledPayments(): PaymentMethod[] {
  const p = getSettings().payments;
  const on = PAYMENT_METHODS.filter((m) => p[m] && gatewayReady(m));
  return on.length ? on : ["cod"];
}

/** Next-day express is offered in Cairo & Giza only, when enabled in settings. */
export const expressAvailableFor = (governorate?: string) => getSettings().checkout.expressEnabled && (governorate === "Cairo" || governorate === "Giza");

export const BUMP_DISCOUNT_PCT = 40;

/** Checkout order bump (admin → Settings → Checkout), or null when disabled / product unavailable. */
export function getBump(): { product: Product; price: number } | null {
  if (!getSettings().checkout.orderBumpEnabled) return null;
  const product = getProductById(getUpsellId());
  if (!product || product.sizes.every((s) => s.stock <= 0)) return null;
  return { product, price: Math.round((product.price * (100 - BUMP_DISCOUNT_PCT)) / 100) };
}

export interface CheckoutInput {
  cart: CartLine[];
  governorate?: string;
  shipping: "standard" | "express";
  payment: PaymentMethod;
  promo?: string | null;
  protection?: boolean;
  bump?: boolean;
}

export interface CheckoutPrice {
  totals: Totals;
  gov?: Governorate;
  express: boolean;
  bump: { product: Product; price: number } | null;
  /** totals before the express surcharge on free shipping — used for the "FREE" label on standard */
  base: Totals;
}

export function priceCheckout(i: CheckoutInput): CheckoutPrice {
  const offer = getOffer();
  const co = getSettings().checkout;
  const gov = getGovernorates().find((g) => g.name === i.governorate);
  const express = i.shipping === "express" && expressAvailableFor(gov?.name);
  const bump = i.bump ? getBump() : null;
  const base = computeTotals(i.cart, {
    promo: i.promo,
    // the prepaid discount only ever applies to a method that is enabled and gateway-backed
    payment: enabledPayments().includes(i.payment) ? i.payment : "cod",
    shippingRate: (gov?.rate ?? offer.shipping) + (express ? co.expressFee : 0),
    protection: !!i.protection && co.protectionEnabled,
    bump: bump?.price ?? 0,
  });
  // Express still costs its surcharge when standard shipping is free.
  const extra = express && base.freeShipping ? co.expressFee : 0;
  const totals = extra ? { ...base, freeShipping: false, shipping: base.shipping + extra, total: base.total + extra } : base;
  return { totals, gov, express, bump, base };
}
