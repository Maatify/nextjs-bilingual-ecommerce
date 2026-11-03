"use server";

import { redirect } from "next/navigation";
import type { TFn } from "@/lib/i18n/admin";
import { getT } from "@/lib/i18n/admin/server";
import { login, logout, verifyLoginCode } from "@/server/auth";

export type LoginState = { error?: string; step?: "password" | "code" } | null;

const safeNext = (v: FormDataEntryValue | null) => {
  const n = typeof v === "string" ? v : "";
  // same-origin admin paths only (no "//host", no backslashes) — prevents open redirects
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(n) && !n.includes("//") ? n : "/admin";
};

/** src/server/auth.ts speaks English — map its messages onto the admin dictionary (unknown text passes through). */
function localize(t: TFn, msg: string | undefined): string | undefined {
  if (!msg) return msg;
  const wait = (s: string) => {
    const m = s.match(/(\d+) (second|minute)s?/);
    return m ? t(m[2] === "second" ? "login.seconds" : "login.minutes", { count: Number(m[1]) }) : "";
  };
  if (msg.startsWith("ADMIN_PASSWORD")) return t("login.errors.noPassword");
  if (msg.startsWith("Sign-in expired")) return t("login.errors.expired");
  const left = msg.match(/^Wrong password\. (\d+) attempts? left/);
  if (left) return t("login.errors.attemptsLeft", { count: Number(left[1]) });
  if (/^Invalid code\..*Try again in/.test(msg)) return t("login.errors.invalidCodeLocked", { time: wait(msg) });
  if (msg.startsWith("Invalid code")) return t("login.errors.invalidCode");
  if (/Too many failed attempts/.test(msg)) return (msg.startsWith("Wrong password") ? t("login.errors.wrongPassword") + " " : "") + t("login.errors.locked", { time: wait(msg) });
  if (msg.startsWith("Wrong password")) return t("login.errors.wrongPassword");
  return msg;
}

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const step = form.get("step") === "code" ? "code" : "password";
  const res = step === "code" ? await verifyLoginCode(String(form.get("code") ?? "")) : await login(String(form.get("password") ?? ""));
  if (!res.ok) {
    const { t } = await getT();
    if (res.needCode) return { step: "code", error: localize(t, res.error) || undefined };
    return { step: "password", error: localize(t, res.error) };
  }
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}
