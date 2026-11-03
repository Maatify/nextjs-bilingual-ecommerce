import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { CartLine, OfferSettings, Product, PromoCode, StoreSnapshot } from "@/lib/types";
import { bogoLabel, bundleTiers, computeTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/i18n/store/config";
import { money } from "@/lib/format";

/*
 * Cart / checkout totals (src/lib/pricing.ts — the single source of truth used by the cart, checkout and the
 * server-side order re-pricing). The store snapshot is injected the same way src/server/store.ts does it.
 */

const product = (id: string, price: number, extra: Partial<Product> = {}): Product =>
  ({
    id,
    handle: id,
    title: id,
    price,
    category: "Hoodies",
    sizes: [{ label: "M", stock: 10 }],
    colors: [{ name: "Black", hex: "#000", images: [] }],
    ...extra,
  }) as unknown as Product;

const BASE_OFFER: OfferSettings = {
  bogoEnabled: true,
  bogo: { buy: 2, get: 1 },
  multiBuy: { enabled: true, qty: 2, pct: 20 },
  freeShippingAt: 1500,
  giftAt: 3500,
  giftName: "Tote",
  shipping: 75,
  prepaidDiscountPct: 5,
  codFee: 0,
  protection: 39,
} as OfferSettings;

const PROMOS: PromoCode[] = [
  { code: "WELCOME10", label: "10% off", pct: 10, active: true },
  { code: "BIG200", label: "EGP 200 off", amount: 200, minSubtotal: 2000, active: true },
  { code: "OFF", label: "disabled", pct: 50, active: false },
];

let offer: OfferSettings;
const products = [
  product("A", 1000),
  product("B", 600),
  product("C", 400),
  // variant price override: size L costs more
  product("V", 500, { sizes: [{ label: "M", stock: 5 }, { label: "L", stock: 5 }], variants: [{ color: "Black", size: "L", stock: 5, price: 700 }] } as Partial<Product>),
];

(globalThis as { __verdaStore?: { snapshot: () => StoreSnapshot } }).__verdaStore = {
  snapshot: () => ({ products, collections: [], reviews: [], settings: { offer, promoCodes: PROMOS }, content: {} }) as unknown as StoreSnapshot,
};

const line = (productId: string, qty = 1, size = "M"): CartLine => ({ key: `${productId}-Black-${size}`, productId, color: "Black", size, qty });

beforeEach(() => {
  offer = structuredClone(BASE_OFFER);
});

describe("computeTotals", () => {
  test("single item below free-shipping threshold pays flat shipping", () => {
    const t = computeTotals([line("A")]);
    assert.equal(t.subtotal, 1000);
    assert.equal(t.bogoDiscount, 0);
    assert.equal(t.multiDiscount, 0);
    assert.equal(t.shipping, 75);
    assert.equal(t.total, 1075);
    assert.equal(t.freeShipping, false);
    assert.equal(t.toNextFree, 2);
  });

  test("multi-buy: 2 pieces → 20% off both", () => {
    const t = computeTotals([line("A", 2)]);
    assert.equal(t.multiDiscount, 400);
    assert.equal(t.bogoDiscount, 0);
    assert.equal(t.shipping, 0, "1,600 after discount ≥ 1,500 → free shipping");
    assert.equal(t.total, 1600);
    assert.equal(t.toNextFree, 1);
  });

  test("Buy 2 Get 1: the cheapest of every 3 is free", () => {
    const t = computeTotals([line("A"), line("B"), line("C")]);
    assert.equal(t.bogoDiscount, 400);
    assert.equal(t.multiDiscount, 0);
    assert.equal(t.lines.find((l) => l.productId === "C")?.freeUnits, 1);
    assert.equal(t.total, 1600);
    assert.equal(t.toNextFree, 3);
  });

  test("5 pieces: one free (B2G1) + multi-buy % on the 2 leftover paid pieces", () => {
    const t = computeTotals([line("A", 3), line("B"), line("C")]);
    assert.equal(t.itemCount, 5);
    assert.equal(t.bogoDiscount, 400); // C free
    assert.equal(t.multiDiscount, 120 + 200); // 20% of B + 20% of one A (cheapest paid units)
    assert.equal(t.total, 4000 - 400 - 320);
    assert.equal(t.gift, false); // 3,280 < 3,500
  });

  test("Buy N Get M switched off → no free units, multi-buy applies to all pieces", () => {
    offer.bogoEnabled = false;
    const t = computeTotals([line("A"), line("B"), line("C")]);
    assert.equal(t.bogoDiscount, 0);
    assert.equal(t.multiDiscount, 200 + 120 + 80);
    assert.equal(t.bogoEnabled, false);
    assert.equal(t.toNextFree, 0);
  });

  test("percentage promo applies after offers", () => {
    const t = computeTotals([line("A")], { promo: "welcome10" });
    assert.equal(t.promoCode, "WELCOME10");
    assert.equal(t.promoDiscount, 100);
    assert.equal(t.total, 900 + 75);
  });

  test("promo with a minimum subtotal is rejected below it and applied above it", () => {
    const low = computeTotals([line("A")], { promo: "BIG200" });
    assert.equal(low.promoDiscount, 0);
    assert.ok(low.promoError);
    const high = computeTotals([line("A", 3)], { promo: "BIG200" }); // 3,000 − 1,000 free = 2,000
    assert.equal(high.promoDiscount, 200);
    assert.equal(high.total, 1800);
  });

  test("unknown and inactive promo codes are not applied", () => {
    assert.ok(computeTotals([line("A")], { promo: "NOPE" }).promoError);
    assert.equal(computeTotals([line("A")], { promo: "OFF" }).promoDiscount, 0);
  });

  test("shipping tiers: governorate rate below the threshold, free at/above it, nothing for an empty cart", () => {
    assert.equal(computeTotals([line("C")], { shippingRate: 110 }).shipping, 110);
    assert.equal(computeTotals([line("A"), line("B")], { shippingRate: 110 }).shipping, 110); // 1,600 − 20% = 1,280 < 1,500
    assert.equal(computeTotals([line("A", 2)], { shippingRate: 110 }).shipping, 0); // 2,000 − 20% = 1,600 ≥ 1,500
    const empty = computeTotals([]);
    assert.equal(empty.shipping, 0);
    assert.equal(empty.total, 0);
  });

  test("cash on delivery has no prepaid discount; protection adds its fee", () => {
    const cod = computeTotals([line("A")], { payment: "cod", protection: true });
    assert.equal(cod.prepaidDiscount, 0);
    assert.equal(cod.protection, 39);
    assert.equal(cod.total, 1000 + 75 + 39);
  });

  test("variant price overrides the product price", () => {
    const t = computeTotals([line("V", 1, "L")]);
    assert.equal(t.subtotal, 700);
  });

  test("unknown products are ignored (never priced from client input)", () => {
    const t = computeTotals([line("ghost", 3)]);
    assert.equal(t.itemCount, 0);
    assert.equal(t.total, 0);
  });
});

describe("bundle tiers & labels", () => {
  test("product-page tiers follow the live offer", () => {
    const tiers = bundleTiers(1000);
    assert.deepEqual(tiers.map((x) => x.qty), [1, 2, 3]);
    assert.equal(tiers[1].total, 1600); // 2 pieces at 20% off
    assert.equal(tiers[2].total, 2000); // 3 for the price of 2
    assert.equal(bogoLabel("en"), "Buy 2, Get 1 Free");
  });
});

describe("price formatting", () => {
  test("English: EGP prefix, thousands separator, whole pounds", () => {
    assert.equal(formatMoney(1590, "en"), "EGP 1,590");
    assert.equal(formatMoney(1590.6, "en"), "EGP 1,591");
    assert.equal(money(0), "EGP 0");
  });
  test("Arabic: Western digits with the ج.م suffix", () => {
    assert.equal(formatMoney(12500, "ar"), "12,500 ج.م");
  });
});
