import type { Dict } from "./en";
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

/** Arabic storefront dictionary — must mirror ./en.ts key for key (enforced by the type). */
export const ar: Dict = {
  common: common.ar,
  layout: layout.ar,
  home: home.ar,
  product: product.ar,
  collection: collection.ar,
  cart: cart.ar,
  checkout: checkout.ar,
  lp: lp.ar,
  pages: pages.ar,
  review: review.ar,
};
