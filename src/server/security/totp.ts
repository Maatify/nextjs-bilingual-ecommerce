import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { kvGet, kvSet } from "./db";

/*
 * TOTP two-factor auth (RFC 6238: HMAC-SHA1, 30 s step, 6 digits, ±1 step window) with
 * replay protection (a step that was already accepted can't be used again) and 8 single-use
 * recovery codes stored as SHA-256 hashes (they're 50 bits of randomness, so a fast hash is fine).
 *
 * sec_kv keys: totp_secret (base32, active), totp_pending (base32, during setup),
 *              totp_last_step, recovery_codes (JSON string[] of hashes)
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const off = mac[mac.length - 1] & 0xf;
  const code = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Returns the matching time step (for replay protection) or null. */
export function verifyTotp(secretB32: string, code: string, at = Date.now()): number | null {
  const c = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const secret = base32Decode(secretB32);
  const step = Math.floor(at / 1000 / STEP);
  let hit: number | null = null;
  for (const d of [-1, 0, 1]) if (eq(hotp(secret, step + d), c)) hit = step + d; // no early exit: constant work
  return hit;
}

export const totpEnabled = () => !!kvGet("totp_secret");

export function otpauthUrl(secretB32: string, account = "admin", issuer = "VEDRA Admin") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

/** Start setup: a fresh secret kept as "pending" until a code is verified. */
export function beginTotpSetup() {
  const secret = base32Encode(randomBytes(20));
  kvSet("totp_pending", secret);
  return { secret, url: otpauthUrl(secret) };
}

const hashCode = (c: string) => createHash("sha256").update(c.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");

function newRecoveryCodes() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  return Array.from({ length: 8 }, () => {
    const b = randomBytes(10);
    const raw = [...b].map((x) => alphabet[x % 32]).join("");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** Confirm setup with a code from the authenticator. Returns the 8 recovery codes (shown once) or null. */
export function confirmTotpSetup(code: string): string[] | null {
  const pending = kvGet("totp_pending");
  if (!pending) return null;
  const step = verifyTotp(pending, code);
  if (step === null) return null;
  const codes = newRecoveryCodes();
  kvSet("totp_secret", pending);
  kvSet("totp_pending", null);
  kvSet("totp_last_step", String(step));
  kvSet("recovery_codes", JSON.stringify(codes.map(hashCode)));
  return codes;
}

export function disableTotp() {
  kvSet("totp_secret", null);
  kvSet("totp_pending", null);
  kvSet("totp_last_step", null);
  kvSet("recovery_codes", null);
}

export function regenerateRecoveryCodes() {
  const codes = newRecoveryCodes();
  kvSet("recovery_codes", JSON.stringify(codes.map(hashCode)));
  return codes;
}

export const recoveryCodesLeft = () => (JSON.parse(kvGet("recovery_codes") ?? "[]") as string[]).length;

/** Check a sign-in second factor: a current TOTP code (not replayed) or an unused recovery code (consumed). */
export function verifySecondFactor(input: string): "totp" | "recovery" | null {
  const secret = kvGet("totp_secret");
  if (!secret) return null;
  const v = input.trim();
  if (/^\d{3}\s?\d{3}$/.test(v)) {
    const step = verifyTotp(secret, v);
    const last = Number(kvGet("totp_last_step") ?? -1);
    if (step === null || step <= last) return null;
    kvSet("totp_last_step", String(step));
    return "totp";
  }
  const h = hashCode(v);
  if (h.length !== 64 || v.replace(/[^A-Za-z0-9]/g, "").length !== 10) return null;
  const list = JSON.parse(kvGet("recovery_codes") ?? "[]") as string[];
  const i = list.findIndex((x) => eq(x, h));
  if (i < 0) return null;
  list.splice(i, 1);
  kvSet("recovery_codes", JSON.stringify(list));
  return "recovery";
}

/** Verify a current code without consuming anything (used to confirm sensitive changes). */
export function checkCurrentTotp(code: string) {
  const secret = kvGet("totp_secret");
  return !!secret && verifyTotp(secret, code) !== null;
}
