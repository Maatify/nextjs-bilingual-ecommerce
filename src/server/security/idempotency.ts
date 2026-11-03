import type { Order } from "@/lib/types";
import { getOrder } from "@/server/store";
import { sdb } from "./db";

/*
 * Order idempotency: the checkout sends `Idempotency-Key: <uuid>` (one per checkout form instance).
 * A repeat POST with the same key within 10 minutes returns the order created by the first one.
 */

const TTL_MS = 10 * 60_000;

export const isIdempotencyKey = (k: string) => /^[A-Za-z0-9-]{16,64}$/.test(k);

export function findIdempotentOrder(key: string): Order | null {
  const now = Date.now();
  sdb().prepare("DELETE FROM sec_idempotency WHERE created_at < ?").run(now - TTL_MS);
  const row = sdb().prepare("SELECT order_number FROM sec_idempotency WHERE key = ?").get(key) as { order_number: string } | undefined;
  return row ? (getOrder(row.order_number) ?? null) : null;
}

export function rememberIdempotentOrder(key: string, orderNumber: string) {
  sdb().prepare("INSERT OR REPLACE INTO sec_idempotency (key, order_number, created_at) VALUES (?, ?, ?)").run(key, orderNumber, Date.now());
}
