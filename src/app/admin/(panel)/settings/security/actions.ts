"use server";

import { redirect } from "next/navigation";
import { changePassword, confirmPassword, getSession, listSessions, revokeAllSessions, revokeSession } from "@/server/auth";
import { guard } from "@/server/admin";
import { passwordInfo } from "@/server/security/password";
import { beginTotpSetup, checkCurrentTotp, confirmTotpSetup, disableTotp, recoveryCodesLeft, regenerateRecoveryCodes, totpEnabled } from "@/server/security/totp";
import { logActivity } from "@/server/store";
import { getT } from "@/lib/i18n/admin/server";
import type { TFn } from "@/lib/i18n/admin";
import { MIN_PASSWORD_LENGTH } from "@/server/security/strength";

/** auth.ts speaks English — map its change-password messages to the admin's language. */
function localizeAuthError(t: TFn, msg: string): string {
  const locked = /^Too many failed attempts\. Try again in (.+)\.$/.exec(msg);
  if (locked) return t("content.security.errors.locked", { time: locked[1] });
  if (msg === "Invalid input") return t("common.errors.invalidInput");
  if (/^Use at least \d+ characters\.$/.test(msg)) return t("content.security.errors.minLength", { min: MIN_PASSWORD_LENGTH });
  if (msg === "Use 256 characters or fewer.") return t("content.security.errors.maxLength");
  if (msg === "Passwords don't match.") return t("content.security.mismatch");
  if (msg === "Current password is incorrect.") return t("content.security.errors.currentWrong");
  if (msg === "The new password must be different.") return t("content.security.errors.different");
  if (msg === "This is one of the most common passwords — it can be guessed in seconds.") return t("content.security.hints.common");
  if (msg.startsWith("Digits only")) return t("content.security.hints.digits");
  if (msg.startsWith("Make it longer")) return t("content.security.hints.weak");
  if (msg === "Choose a stronger password.") return t("content.security.errors.stronger");
  return msg;
}

export interface SecurityOverview {
  password: { weak: boolean; changedAt: string | null; source: string };
  twoFactor: { enabled: boolean; recoveryLeft: number };
  sessions: Awaited<ReturnType<typeof listSessions>>;
}

type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; field?: string };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function getSecurityOverview(): Promise<SecurityOverview> {
  await guard();
  return { password: passwordInfo(), twoFactor: { enabled: totpEnabled(), recoveryLeft: recoveryCodesLeft() }, sessions: await listSessions() };
}

export async function changePasswordAction(current: string, next: string, confirm: string): Promise<R> {
  await guard();
  const r = await changePassword(s(current, 300), s(next, 300), s(confirm, 300));
  if (r.ok) return { ok: true };
  const { t } = await getT();
  return { ...r, error: localizeAuthError(t, r.error) };
}

/** Step 1 of enabling 2FA: new pending secret (not active until confirmed). */
export async function startTwoFactor(): Promise<R<{ secret: string; url: string }>> {
  await guard();
  if (totpEnabled()) return { ok: false, error: (await getT()).t("content.security.errors.alreadyOn") };
  return { ok: true, data: beginTotpSetup() };
}

/** Step 2: verify a code from the app → 2FA on, returns the 8 recovery codes (shown once). */
export async function confirmTwoFactor(code: string): Promise<R<{ codes: string[] }>> {
  await guard();
  const codes = confirmTotpSetup(s(code, 12));
  if (!codes) return { ok: false, error: (await getT()).t("content.security.errors.codeMismatch"), field: "code" };
  logActivity("Two-factor authentication enabled", "Security");
  return { ok: true, data: { codes } };
}

export async function disableTwoFactor(password: string, code: string): Promise<R> {
  await guard();
  const { t } = await getT();
  if (!(await confirmPassword(s(password, 300)))) return { ok: false, error: t("content.security.errors.passwordIncorrect"), field: "password" };
  if (!checkCurrentTotp(s(code, 12))) return { ok: false, error: t("content.security.errors.needCode"), field: "code" };
  disableTotp();
  logActivity("Two-factor authentication disabled", "Security");
  return { ok: true };
}

export async function newRecoveryCodes(password: string): Promise<R<{ codes: string[] }>> {
  await guard();
  const { t } = await getT();
  if (!totpEnabled()) return { ok: false, error: t("content.security.errors.isOff") };
  if (!(await confirmPassword(s(password, 300)))) return { ok: false, error: t("content.security.errors.passwordIncorrect"), field: "password" };
  logActivity("Recovery codes regenerated", "Security");
  return { ok: true, data: { codes: regenerateRecoveryCodes() } };
}

export async function revokeSessionAction(id: string): Promise<R> {
  await guard();
  const me = await getSession();
  const { t } = await getT();
  if (typeof id !== "string" || !/^[0-9a-f]{16}$/.test(id)) return { ok: false, error: t("content.security.errors.invalidSession") };
  if (me?.id_hash.startsWith(id)) return { ok: false, error: t("content.security.errors.useSignOut") };
  if (!(await revokeSession(id))) return { ok: false, error: t("content.security.errors.sessionEnded") };
  logActivity("Session revoked", "Security");
  return { ok: true };
}

export async function signOutEverywhere() {
  await guard();
  await revokeAllSessions();
  logActivity("Signed out everywhere", "Security", "All sessions revoked");
  redirect("/admin/login");
}
