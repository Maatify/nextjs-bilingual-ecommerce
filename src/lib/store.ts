"use client";

import { useSyncExternalStore } from "react";
import type { CartLine } from "./types";

/**
 * Tiny persisted client store (cart, wishlist, recently viewed, UI flags).
 * No dependency, SSR-safe: the server snapshot is always the empty state,
 * so markup is identical until hydration reads localStorage.
 */

export interface State {
  cart: CartLine[];
  wishlist: string[];
  recent: string[];
  cartOpen: boolean;
  searchOpen: boolean;
  promo: string | null;
  toast: { id: number; title: string; body?: string; image?: string } | null;
  hydrated: boolean;
}

const KEY = "verda:v1";
const empty: State = { cart: [], wishlist: [], recent: [], cartOpen: false, searchOpen: false, promo: null, toast: null, hydrated: false };

let state: State = empty;
const listeners = new Set<() => void>();

function persist() {
  try {
    const { cart, wishlist, recent, promo } = state;
    localStorage.setItem(KEY, JSON.stringify({ cart, wishlist, recent, promo }));
  } catch {}
}

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  persist();
  listeners.forEach((l) => l());
}

function hydrate() {
  if (state.hydrated || typeof window === "undefined") return;
  let saved: Partial<State> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {}
  state = { ...state, ...saved, hydrated: true };
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      state = { ...state, ...JSON.parse(e.newValue) };
      listeners.forEach((l) => l());
    } catch {}
  });
}

function subscribe(l: () => void) {
  hydrate();
  listeners.add(l);
  // first subscriber after hydration must re-read
  queueMicrotask(l);
  return () => listeners.delete(l);
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(empty),
  );
}

const lineKey = (productId: string, color: string, size: string) => `${productId}|${color}|${size}`;
let toastId = 0;

export const actions = {
  add(line: Omit<CartLine, "key" | "qty">, qty = 1, opts: { open?: boolean } = {}) {
    const key = lineKey(line.productId, line.color, line.size);
    set((s) => {
      const hit = s.cart.find((l) => l.key === key);
      const cart = hit
        ? s.cart.map((l) => (l.key === key ? { ...l, qty: Math.min(10, l.qty + qty) } : l))
        : [...s.cart, { ...line, key, qty }];
      return { cart, cartOpen: opts.open ?? true };
    });
  },
  setQty(key: string, qty: number) {
    set((s) => ({ cart: qty <= 0 ? s.cart.filter((l) => l.key !== key) : s.cart.map((l) => (l.key === key ? { ...l, qty: Math.min(10, qty) } : l)) }));
  },
  changeVariant(key: string, color: string, size: string) {
    set((s) => {
      const line = s.cart.find((l) => l.key === key);
      if (!line) return {};
      const nextKey = lineKey(line.productId, color, size);
      const rest = s.cart.filter((l) => l.key !== key);
      const dupe = rest.find((l) => l.key === nextKey);
      if (dupe) return { cart: rest.map((l) => (l.key === nextKey ? { ...l, qty: l.qty + line.qty } : l)) };
      return { cart: s.cart.map((l) => (l.key === key ? { ...l, key: nextKey, color, size } : l)) };
    });
  },
  remove(key: string) {
    set((s) => ({ cart: s.cart.filter((l) => l.key !== key) }));
  },
  clearCart() {
    set({ cart: [], promo: null, cartOpen: false });
  },
  toggleWish(id: string) {
    set((s) => ({ wishlist: s.wishlist.includes(id) ? s.wishlist.filter((w) => w !== id) : [id, ...s.wishlist] }));
  },
  viewed(id: string) {
    set((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 12) }));
  },
  setCartOpen(cartOpen: boolean) {
    set({ cartOpen });
  },
  setSearchOpen(searchOpen: boolean) {
    set({ searchOpen });
  },
  setPromo(promo: string | null) {
    set({ promo });
  },
  toast(t: Omit<NonNullable<State["toast"]>, "id">) {
    const id = ++toastId;
    set({ toast: { ...t, id } });
    setTimeout(() => state.toast?.id === id && set({ toast: null }), 3200);
  },
};
