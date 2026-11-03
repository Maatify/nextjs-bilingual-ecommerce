import { getDb } from "@/server/store";

/*
 * Security tables (kept out of the store's backup/export on purpose — credentials,
 * sessions and throttling state never leave the server).
 *
 *   sec_kv            password hash, TOTP secret/state, recovery-code hashes
 *   sec_sessions      admin sessions (id stored as SHA-256 hash only)
 *   sec_challenges    pending 2-factor sign-ins (password ok, waiting for code)
 *   sec_throttle      persistent login failure counters (per IP + global)
 *   sec_rate          fixed-window counters for public API rate limits
 *   sec_idempotency   order Idempotency-Key → order number (10 min)
 */

type G = typeof globalThis & { __verdaSecReady?: boolean };
const g = globalThis as G;

export function sdb() {
  const db = getDb();
  if (!g.__verdaSecReady) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sec_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sec_sessions (id_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL, ip TEXT, ua TEXT);
      CREATE TABLE IF NOT EXISTS sec_challenges (id_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sec_throttle (key TEXT PRIMARY KEY, fails INTEGER NOT NULL, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, locked_until INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sec_rate (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sec_idempotency (key TEXT PRIMARY KEY, order_number TEXT NOT NULL, created_at INTEGER NOT NULL);
    `);
    g.__verdaSecReady = true;
  }
  return db;
}

export function kvGet(key: string): string | null {
  const row = sdb().prepare("SELECT value FROM sec_kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function kvSet(key: string, value: string | null) {
  if (value === null) sdb().prepare("DELETE FROM sec_kv WHERE key = ?").run(key);
  else sdb().prepare("INSERT INTO sec_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
