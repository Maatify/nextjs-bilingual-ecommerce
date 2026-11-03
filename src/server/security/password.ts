import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { kvGet, kvSet } from "./db";
import { isWeakPassword } from "./strength";

/*
 * Admin password storage: scrypt (N=2^15, r=8, p=1, 16-byte per-password salt, 32-byte key),
 * encoded "scrypt$N$r$p$<salt b64>$<hash b64>" in sec_kv["password_hash"].
 *
 * Bootstrap: on first use, ADMIN_PASSWORD from the environment is hashed into the DB so the
 * existing password keeps working. From then on the DB hash is authoritative and the env value
 * is ignored — except for recovery: set ADMIN_PASSWORD_RESET=1 (with a new ADMIN_PASSWORD) and
 * restart; the next sign-in attempt re-hashes it, disables 2FA and revokes every session (applied
 * once per distinct ADMIN_PASSWORD value).
 */

const N = 1 << 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

function scrypt(pw: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => scryptCb(pw.normalize("NFKC"), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  const parts = stored?.split("$");
  if (!parts || parts.length !== 6 || parts[0] !== "scrypt") {
    // keep timing roughly equal when no hash exists
    await scrypt(pw, Buffer.alloc(16), KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
    return false;
  }
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const key = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export type CredentialEvent = "bootstrapped" | "reset" | null;

/**
 * Make sure a password hash exists (bootstrap from env) and apply an env-driven reset if requested.
 * Returns what happened so the caller can log it / revoke sessions.
 */
export async function ensureCredentials(): Promise<CredentialEvent> {
  const env = process.env.ADMIN_PASSWORD;
  const current = kvGet("password_hash");
  if (!current) {
    if (!env) return null;
    kvSet("password_hash", await hashPassword(env));
    kvSet("password_weak", isWeakPassword(env) ? "1" : "0");
    kvSet("password_changed_at", String(Date.now()));
    kvSet("password_source", "env");
    return "bootstrapped";
  }
  if (env && process.env.ADMIN_PASSWORD_RESET && !(await verifyPassword(env, kvGet("reset_applied")))) {
    const h = await hashPassword(env);
    kvSet("password_hash", h);
    kvSet("reset_applied", h);
    kvSet("password_weak", isWeakPassword(env) ? "1" : "0");
    kvSet("password_changed_at", String(Date.now()));
    kvSet("password_source", "env-reset");
    return "reset";
  }
  return null;
}

export const hasPassword = () => !!kvGet("password_hash");

export async function checkPassword(pw: string) {
  return verifyPassword(pw, kvGet("password_hash"));
}

export async function setPassword(pw: string) {
  kvSet("password_hash", await hashPassword(pw));
  kvSet("password_weak", isWeakPassword(pw) ? "1" : "0");
  kvSet("password_changed_at", String(Date.now()));
  kvSet("password_source", "dashboard");
}

/** Re-evaluate the weak flag from a plaintext we just verified (catches passwords stored before the flag existed). */
export function notePasswordStrength(pw: string) {
  const weak = isWeakPassword(pw) ? "1" : "0";
  if (kvGet("password_weak") !== weak) kvSet("password_weak", weak);
}

export function passwordInfo() {
  const at = Number(kvGet("password_changed_at") ?? 0);
  return { weak: kvGet("password_weak") === "1", changedAt: at ? new Date(at).toISOString() : null, source: kvGet("password_source") ?? "env" };
}
