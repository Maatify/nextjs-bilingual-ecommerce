import type { Widen } from "./config";
import * as cart from "./messages/cart";
import * as checkout from "./messages/checkout";
import * as collection from "./messages/collection";
import * as common from "./messages/common";
import * as home from "./messages/home";
import * as layout from "./messages/layout";
import * as lp from "./messages/lp";
import * as pages from "./messages/pages";
import * as product from "./messages/product";
import * as review from "./messages/review";

/** English storefront dictionary (source of truth for keys). Namespaces live in ./messages/<ns>.ts. */
export const en = {
  common: common.en,
  layout: layout.en,
  home: home.en,
  product: product.en,
  collection: collection.en,
  cart: cart.en,
  checkout: checkout.en,
  lp: lp.en,
  pages: pages.en,
  review: review.en,
};

/** Widened shape shared by both languages (plural objects → PluralForms). */
export type Dict = Widen<typeof en>;
