import { sdb } from "./db";

/*
 * Persistent sign-in throttling (survives restarts — stored in sec_throttle).
 *
 *  per IP   5 free failures, then exponential lockout: 30 s, 1 min, 2 min, 4 min … capped at 1 h.
 *           Counter resets on a successful sign-in or 24 h after the last failure.
 *  global   100 failures within an hour (any IP — catches distributed / spoofed-IP guessing), then
 *           exponential lockout from 10 s, capped at 15 min. Capped low so an attacker can't lock
 *           the owner out for long.
 */

const PER_IP = { free: 5, base: 30_000, cap: 3_600_000, reset: 24 * 3_600_000 };
const GLOBAL = { free: 100, base: 10_000, cap: 15 * 60_000, reset: 3_600_000 };

type Row = { key: string; fails: number; first_at: number; last_at: number; locked_until: number };

const get = (key: string) => sdb().prepare("SELECT key, fails, first_at, last_at, locked_until FROM sec_throttle WHERE key = ?").get(key) as Row | undefined;

function bump(key: string, cfg: typeof PER_IP, now: number) {
  const r = get(key);
  const fresh = !r || now - (cfg === GLOBAL ? r.first_at : r.last_at) > cfg.reset;
  const fails = fresh ? 1 : r!.fails + 1;
  const first = fresh ? now : r!.first_at;
  const over = fails - cfg.free;
  const locked = over >= 0 ? now + Math.min(cfg.base * 2 ** over, cfg.cap) : 0;
  sdb()
    .prepare("INSERT INTO sec_throttle (key, fails, first_at, last_at, locked_until) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET fails = excluded.fails, first_at = excluded.first_at, last_at = excluded.last_at, locked_until = excluded.locked_until")
    .run(key, fails, first, now, locked);
  return { fails, locked };
}

/** ms until this IP may try again (0 = allowed). */
export function throttleWait(ip: string, now = Date.now()) {
  const a = get(`ip:${ip}`)?.locked_until ?? 0;
  const b = get("global")?.locked_until ?? 0;
  return Math.max(0, a - now, b - now);
}

export function recordFailure(ip: string, now = Date.now()) {
  const r = bump(`ip:${ip}`, PER_IP, now);
  bump("global", GLOBAL, now);
  return { fails: r.fails, remaining: Math.max(0, PER_IP.free - r.fails), wait: throttleWait(ip, now) };
}

export function recordSuccess(ip: string) {
  sdb().prepare("DELETE FROM sec_throttle WHERE key = ?").run(`ip:${ip}`);
}

export function humanWait(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}
