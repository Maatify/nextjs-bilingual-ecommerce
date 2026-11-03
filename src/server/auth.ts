import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { CHALLENGE_COOKIE, CHALLENGE_COOKIE_SECURE, SESSION_COOKIE, SESSION_COOKIE_SECURE, secureCookies } from "./security/cookie-names";
import { checkPassword, ensureCredentials, hasPassword, notePasswordStrength, setPassword } from "./security/password";
import { clientIp } from "./security/rate-limit";
import { ABSOLUTE_MS, createChallenge, createSession, deleteSession, deleteSessionsExcept, dropChallenge, listSessionRows, readSession, tokenHash, consumeChallengeAttempt } from "./security/sessions";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "./security/strength";
import { humanWait, recordFailure, recordSuccess, throttleWait } from "./security/throttle";
import { disableTotp, totpEnabled, verifySecondFactor } from "./security/totp";
import { describeUA } from "./security/ua";
import { logActivity } from "./store";

/*
 * Single-owner admin auth.
 *  - Password: scrypt hash in the DB (bootstrapped from ADMIN_PASSWORD — see security/password.ts).
 *  - Sessions: server-side (security/sessions.ts); cookie = random 256-bit token, httpOnly, SameSite=Lax,
 *    Secure + `__Host-` prefix in production (ADMIN_INSECURE_COOKIE=1 to test a prod build over plain http on
 *    localhost / LAN — ignored for https or public hosts, see security/cookie-names.ts).
 *    Idle timeout 12 h, absolute 7 d, new id on every sign-in.
 *  - Optional TOTP 2FA with recovery codes (security/totp.ts).
 *  - Persistent throttling per IP + global (security/throttle.ts); every attempt goes to the activity log.
 * Every admin page and server action calls requireAdmin() (via guard()). src/proxy.ts only does a cheap
 * cookie-presence redirect — the real check is always here.
 */

// secure-cookie mode is decided per request (ADMIN_INSECURE_COOKIE only applies to plain-http local requests)
const secure = async () => secureCookies(await headers());
const sessionCookie = async () => ((await secure()) ? SESSION_COOKIE_SECURE : SESSION_COOKIE);
const challengeCookie = async () => ((await secure()) ? CHALLENGE_COOKIE_SECURE : CHALLENGE_COOKIE);
const cookieOpts = async (maxAgeSec: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: await secure(), path: "/", maxAge: maxAgeSec });
/** Expire a cookie with the same attributes it was set with (a bare delete lacks Secure, which `__Host-` cookies reject). */
const clearCookie = async (jar: Awaited<ReturnType<typeof cookies>>, name: string) => jar.set(name, "", await cookieOpts(0));

/** Current session row (memoised per request). */
export const getSession = cache(async () => readSession((await cookies()).get(await sessionCookie())?.value));

export async function isAdmin() {
  return !!(await getSession());
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

async function requestMeta(ip?: string) {
  const h = await headers();
  return { ip: ip && ip !== "local" ? ip : clientIp(h), ua: (h.get("user-agent") ?? "").slice(0, 300) };
}

const metaLine = (ip: string, ua: string, extra?: string) => [extra, ip, describeUA(ua)].filter(Boolean).join(" · ");

async function prepareCredentials() {
  const ev = await ensureCredentials();
  if (ev === "bootstrapped") logActivity("Admin password stored", "Security", "Hashed from ADMIN_PASSWORD (scrypt)", "system");
  if (ev === "reset") {
    deleteSessionsExcept(null);
    disableTotp();
    logActivity("Admin password reset", "Security", "From ADMIN_PASSWORD_RESET — sessions revoked, 2FA disabled", "system");
  }
}

type LoginResult = { ok: true } | { ok: false; error: string; needCode?: boolean; restart?: boolean };

async function startSession(ip: string, ua: string, method: string) {
  const jar = await cookies();
  // rotate: the pre-login session id (if any) is destroyed, a fresh one issued
  const old = jar.get(await sessionCookie())?.value;
  if (old) deleteSession(tokenHash(old));
  const { token } = createSession(ip, ua);
  jar.set(await sessionCookie(), token, await cookieOpts(ABSOLUTE_MS / 1000));
  recordSuccess(ip);
  logActivity("Signed in", "Admin", metaLine(ip, ua, method));
}

function lockedMessage(wait: number) {
  return `Too many failed attempts. Try again in ${humanWait(wait)}.`;
}

/** Step 1: password. With 2FA enabled this returns { needCode: true } and sets a 5-minute challenge cookie. */
export async function login(password: string, ip?: string): Promise<LoginResult> {
  const m = await requestMeta(ip);
  await prepareCredentials();
  if (!hasPassword()) return { ok: false, error: "ADMIN_PASSWORD is not set on the server." };
  const wait = throttleWait(m.ip);
  if (wait) return { ok: false, error: lockedMessage(wait) };

  const pw = typeof password === "string" ? password : "";
  const good = pw.length > 0 && pw.length <= 256 && (await checkPassword(pw));
  if (!good) {
    const r = recordFailure(m.ip);
    logActivity("Sign-in failed", "Admin", metaLine(m.ip, m.ua, "wrong password"), "system");
    if (r.wait) return { ok: false, error: `Wrong password. ${lockedMessage(r.wait)}` };
    return { ok: false, error: r.remaining <= 2 ? `Wrong password. ${r.remaining} attempt${r.remaining === 1 ? "" : "s"} left before a temporary lockout.` : "Wrong password." };
  }
  notePasswordStrength(pw);

  if (totpEnabled()) {
    (await cookies()).set(await challengeCookie(), createChallenge(), await cookieOpts(5 * 60));
    return { ok: false, error: "", needCode: true };
  }
  await startSession(m.ip, m.ua, "password");
  return { ok: true };
}

/** Step 2 (2FA only): authenticator code or a recovery code. */
export async function verifyLoginCode(code: string, ip?: string): Promise<LoginResult> {
  const m = await requestMeta(ip);
  const jar = await cookies();
  const wait = throttleWait(m.ip);
  if (wait) return { ok: false, error: lockedMessage(wait), needCode: true };
  const challenge = jar.get(await challengeCookie())?.value;
  if (!consumeChallengeAttempt(challenge)) {
    await clearCookie(jar, await challengeCookie());
    return { ok: false, error: "Sign-in expired — enter your password again.", restart: true };
  }
  const c = typeof code === "string" ? code.slice(0, 32) : "";
  const method = verifySecondFactor(c);
  if (!method) {
    const r = recordFailure(m.ip);
    logActivity("Sign-in failed", "Admin", metaLine(m.ip, m.ua, "wrong 2FA code"), "system");
    return { ok: false, error: r.wait ? `Invalid code. ${lockedMessage(r.wait)}` : "Invalid code. Check your authenticator app's clock and try again.", needCode: true };
  }
  dropChallenge(challenge);
  await clearCookie(jar, await challengeCookie());
  await startSession(m.ip, m.ua, method === "recovery" ? "password + recovery code" : "password + 2FA");
  if (method === "recovery") logActivity("Recovery code used", "Security", metaLine(m.ip, m.ua));
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const t = jar.get(await sessionCookie())?.value;
  if (t) deleteSession(tokenHash(t));
  await clearCookie(jar, await sessionCookie());
}

/* ── session management (Security tab) ── */

export async function listSessions() {
  const current = await getSession();
  return listSessionRows().map((r) => ({
    id: r.id_hash.slice(0, 16),
    current: r.id_hash === current?.id_hash,
    createdAt: new Date(r.created_at).toISOString(),
    lastSeen: new Date(r.last_seen).toISOString(),
    expiresAt: new Date(r.expires_at).toISOString(),
    ip: r.ip ?? "",
    device: describeUA(r.ua),
  }));
}

/** Revoke one session by its public id (first 16 hex chars of the hash). */
export async function revokeSession(id: string) {
  if (!/^[0-9a-f]{16}$/.test(id)) return false;
  const row = listSessionRows().find((r) => r.id_hash.startsWith(id));
  if (!row) return false;
  deleteSession(row.id_hash);
  return true;
}

/** Sign out every device, including this one. */
export async function revokeAllSessions() {
  deleteSessionsExcept(null);
  await clearCookie(await cookies(), await sessionCookie());
}

export async function changePassword(current: string, next: string, confirm: string): Promise<{ ok: true } | { ok: false; error: string; field?: "current" | "next" | "confirm" }> {
  const m = await requestMeta();
  const wait = throttleWait(m.ip);
  if (wait) return { ok: false, error: lockedMessage(wait), field: "current" };
  if (typeof current !== "string" || typeof next !== "string" || typeof confirm !== "string") return { ok: false, error: "Invalid input" };
  if (next.length < MIN_PASSWORD_LENGTH) return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`, field: "next" };
  if (next.length > 256) return { ok: false, error: "Use 256 characters or fewer.", field: "next" };
  const s = passwordStrength(next);
  if (s.common || s.score < 2) return { ok: false, error: s.hint ?? "Choose a stronger password.", field: "next" };
  if (next !== confirm) return { ok: false, error: "Passwords don't match.", field: "confirm" };
  if (current.length > 256 || !(await checkPassword(current))) {
    recordFailure(m.ip);
    logActivity("Password change failed", "Security", metaLine(m.ip, m.ua, "wrong current password"), "system");
    return { ok: false, error: "Current password is incorrect.", field: "current" };
  }
  if (current === next) return { ok: false, error: "The new password must be different.", field: "next" };
  await setPassword(next);
  // everyone else is signed out; this browser gets a fresh session id
  const keep = await getSession();
  deleteSessionsExcept(null);
  if (keep) await startSession(m.ip, m.ua, "password changed");
  logActivity("Password changed", "Security", metaLine(m.ip, m.ua, "other sessions revoked"));
  return { ok: true };
}

/** Re-check the password for sensitive changes (disable 2FA, new recovery codes). Throttled like sign-in. */
export async function confirmPassword(pw: string) {
  const m = await requestMeta();
  if (throttleWait(m.ip)) return false;
  const ok = typeof pw === "string" && pw.length <= 256 && (await checkPassword(pw));
  if (!ok) recordFailure(m.ip);
  return ok;
}
