"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/provider";
import { getProductById } from "@/lib/catalog";
import { actions, useStore } from "@/lib/store";

/**
 * `/cart?restore=<checkout id>` — the link in an abandoned-checkout WhatsApp message.
 * Fetches the bag lines (no personal data) and puts them back in the cart, once.
 */
export function CartRestore() {
  const params = useSearchParams();
  const router = useRouter();
  const { d, p, href } = useI18n();
  const id = params.get("restore");
  const hydrated = useStore((s) => s.hydrated);
  const cart = useStore((s) => s.cart);
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (!id || !hydrated || done.current === id) return;
    done.current = id;
    fetch(`/api/checkouts/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lines?: { productId: string; color: string; size: string; qty: number }[] } | null) => {
        const lines = (data?.lines ?? []).filter((l) => getProductById(l.productId));
        for (const l of lines) {
          const key = `${l.productId}|${l.color}|${l.size}`;
          const have = cart.find((c) => c.key === key);
          if (have) {
            if (have.qty < l.qty) actions.setQty(key, l.qty);
          } else actions.add({ productId: l.productId, color: l.color, size: l.size }, l.qty, { open: false });
        }
        if (lines.length) actions.toast({ title: d.cart.restore.title, body: p(d.cart.restore.body, lines.length) });
      })
      .catch(() => {})
      .finally(() => router.replace(href("/cart"), { scroll: false }));
  }, [id, hydrated, cart, router, d, p, href]);

  return null;
}
