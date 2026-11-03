import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { OfferSettings, Product, StoreSnapshot } from "@/lib/types";
import { enabledPayments, gatewayReady, priceCheckout } from "@/lib/checkout";

/*
 * Payment methods (src/lib/checkout.ts). No online payment gateway is integrated, so only cash on delivery may be
 * offered or accepted, and the prepaid discount must never apply, whatever the payment switches in Settings say.
 * POST /api/orders rejects any method that enabledPayments() doesn't return.
 */

const product = { id: "A", handle: "a", title: "A", price: 1000, category: "Hoodies", sizes: [{ label: "M", stock: 10 }], colors: [{ name: "Black", hex: "#000", images: [] }] } as unknown as Product;

const offer = { bogoEnabled: false, bogo: { buy: 2, get: 1 }, multiBuy: { enabled: false, qty: 2, pct: 0 }, freeShippingAt: 99_999, giftAt: 0, giftName: "", shipping: 75, prepaidDiscountPct: 5, codFee: 0, protection: 0 } as unknown as OfferSettings;

let payments: { cod: boolean; card: boolean; wallet: boolean; installments: boolean };

(globalThis as { __verdaStore?: { snapshot: () => StoreSnapshot } }).__verdaStore = {
  snapshot: () =>
    ({
      products: [product],
      collections: [],
      reviews: [],
      content: {},
      settings: { offer, promoCodes: [], payments, governorates: [], checkout: { protectionEnabled: false, orderBumpEnabled: false, expressEnabled: false, expressFee: 0 } },
    }) as unknown as StoreSnapshot,
};

const cart = [{ key: "A-Black-M", productId: "A", color: "Black", size: "M", qty: 1 }];

beforeEach(() => {
  payments = { cod: true, card: true, wallet: true, installments: true };
});

describe("payment methods without a gateway", () => {
  test("only cash on delivery is gateway-ready", () => {
    assert.equal(gatewayReady("cod"), true);
    for (const m of ["card", "wallet", "installments"] as const) assert.equal(gatewayReady(m), false, m);
  });

  test("card / wallet / installments switched on in Settings are still not offered", () => {
    assert.deepEqual(enabledPayments(), ["cod"]);
  });

  test("falls back to cash on delivery when every switch is off", () => {
    payments = { cod: false, card: false, wallet: false, installments: false };
    assert.deepEqual(enabledPayments(), ["cod"]);
  });

  test("a card or wallet payment never gets the prepaid discount", () => {
    for (const payment of ["card", "wallet", "installments", "cod"] as const) {
      const { totals } = priceCheckout({ cart, shipping: "standard", payment });
      assert.equal(totals.prepaidDiscount, 0, payment);
      assert.equal(totals.total, 1075, payment);
    }
  });
});
