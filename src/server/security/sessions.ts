import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sdb } from "./db";

/*
 * Server-side admin sessions. The browser holds a random 256-bit token; the DB only stores its
 * SHA-256, so a leaked database can't be replayed as a cookie. Idle timeout 12 h, absolute 7 d.
 */

export const IDLE_MS = 12 * 3_600_000;
export const ABSOLUTE_MS = 7 * 24 * 3_600_000;
const TOUCH_EVERY_MS = 60_000;

export interface SessionRow {
  id_hash: string;
  created_at: number;
  last_seen: number;
  expires_at: number;
  ip: string | null;
  ua: string | null;
}

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

function prune(now: number) {
  sdb().prepare("DELETE FROM sec_sessions WHERE expires_at < ? OR last_seen < ?").run(now, now - IDLE_MS);
  sdb().prepare("DELETE FROM sec_challenges WHERE expires_at < ?").run(now);
}

export function createSession(ip: string, ua: string) {
  const now = Date.now();
  prune(now);
  const token = newToken();
  sdb()
    .prepare("INSERT INTO sec_sessions (id_hash, created_at, last_seen, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?, ?)")
    .run(tokenHash(token), now, now, now + ABSOLUTE_MS, ip.slice(0, 64), ua.slice(0, 300));
  return { token, expiresAt: now + ABSOLUTE_MS };
}

/** Validate a cookie token; refreshes last-seen at most once a minute. */
export function readSession(token: string | undefined): SessionRow | null {
  if (!token || token.length < 40 || token.length > 64) return null;
  const h = tokenHash(token);
  const row = sdb().prepare("SELECT id_hash, created_at, last_seen, expires_at, ip, ua FROM sec_sessions WHERE id_hash = ?").get(h) as SessionRow | undefined;
  if (!row || !timingSafeEqual(Buffer.from(row.id_hash), Buffer.from(h))) return null;
  const now = Date.now();
  if (row.expires_at < now || now - row.last_seen > IDLE_MS) {
    deleteSession(h);
    return null;
  }
  if (now - row.last_seen > TOUCH_EVERY_MS) {
    sdb().prepare("UPDATE sec_sessions SET last_seen = ? WHERE id_hash = ?").run(now, h);
    row.last_seen = now;
  }
  return { ...row };
}

export function deleteSession(idHash: string) {
  sdb().prepare("DELETE FROM sec_sessions WHERE id_hash = ?").run(idHash);
}

export function deleteSessionsExcept(keepHash: string | null) {
  if (keepHash) sdb().prepare("DELETE FROM sec_sessions WHERE id_hash != ?").run(keepHash);
  else sdb().prepare("DELETE FROM sec_sessions").run();
}

export function listSessionRows(): SessionRow[] {
  prune(Date.now());
  return (sdb().prepare("SELECT id_hash, created_at, last_seen, expires_at, ip, ua FROM sec_sessions ORDER BY last_seen DESC").all() as unknown as SessionRow[]).map((r) => ({ ...r }));
}

/* ── pending 2-factor challenges (password verified, waiting for a code) ── */

export function createChallenge() {
  const token = newToken();
  sdb().prepare("INSERT INTO sec_challenges (id_hash, expires_at, attempts) VALUES (?, ?, 0)").run(tokenHash(token), Date.now() + 5 * 60_000);
  return token;
}

/** Returns true while the challenge is valid; counts an attempt (max 5). */
export function consumeChallengeAttempt(token: string | undefined) {
  if (!token || token.length > 64) return false;
  const h = tokenHash(token);
  const row = sdb().prepare("SELECT expires_at, attempts FROM sec_challenges WHERE id_hash = ?").get(h) as { expires_at: number; attempts: number } | undefined;
  if (!row || row.expires_at < Date.now() || row.attempts >= 5) {
    if (row) sdb().prepare("DELETE FROM sec_challenges WHERE id_hash = ?").run(h);
    return false;
  }
  sdb().prepare("UPDATE sec_challenges SET attempts = attempts + 1 WHERE id_hash = ?").run(h);
  return true;
}

export function dropChallenge(token: string | undefined) {
  if (token) sdb().prepare("DELETE FROM sec_challenges WHERE id_hash = ?").run(tokenHash(token));
}
