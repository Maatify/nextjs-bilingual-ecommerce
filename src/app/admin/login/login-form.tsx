"use client";

import { motion } from "motion/react";
import { useActionState, useState } from "react";
import { AIcon } from "@/components/admin/icons";
import { useT } from "@/components/admin/i18n";
import { LangSwitch } from "@/components/admin/i18n/lang-switch";
import { Button, ease, inputClass } from "@/components/admin/ui";
import { cx } from "@/lib/format";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const { t, isRtl } = useT();
  const [state, action, pending] = useActionState(loginAction, null);
  const [show, setShow] = useState(false);
  const codeStep = state?.step === "code";
  return (
    <main className="relative grid h-full place-items-center overflow-y-auto p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div className="absolute left-1/2 top-[-20%] size-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(139_116_255/0.22),transparent_62%)] blur-2xl" animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
        <div className="absolute inset-0 bg-[linear-gradient(color-mix(in_oklab,var(--color-a-ink)_4%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--color-a-ink)_4%,transparent)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>

      <div className="absolute end-4 top-4 z-[1]">
        <LangSwitch />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, ease }} className="relative w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.span initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }} className="a-grad grid size-12 place-items-center rounded-2xl font-poster text-[22px] text-white shadow-[0_12px_40px_-10px_rgb(139_116_255/0.8)]">
            V
          </motion.span>
          <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">{t("login.welcome")}</h1>
          <p className="mt-1 text-[13.5px] text-a-dim">{t("login.subtitle")}</p>
        </div>

        <form action={action} className="rounded-2xl border border-a-line bg-a-panel/80 p-5 shadow-[0_30px_80px_-30px_var(--a-shadow)] backdrop-blur">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="step" value={codeStep ? "code" : "password"} />
          {codeStep ? (
            <motion.div key="code" initial={{ opacity: 0, x: isRtl ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease }}>
              <label htmlFor="code" className="mb-1.5 block text-[12.5px] font-medium text-a-dim">
                {t("login.code")}
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                required
                maxLength={32}
                dir="ltr"
                lang="en"
                className={cx(inputClass, "h-11 text-center font-mono text-[17px] tracking-[0.3em]", state?.error && "border-a-danger/60")}
                placeholder="123 456"
                aria-describedby="code-help"
              />
              <p id="code-help" className="mt-2 text-[12px] leading-relaxed text-a-faint">
                {t("login.codeHelp")}
              </p>
            </motion.div>
          ) : (
            <>
              <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium text-a-dim">
                {t("login.password")}
              </label>
              <div className="relative">
                <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" autoFocus required maxLength={256} dir="ltr" className={cx(inputClass, "h-11", isRtl ? "ps-11 pe-3 text-end" : "pe-11", state?.error && "border-a-danger/60")} placeholder="••••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("login.hidePassword") : t("login.showPassword")} className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-a-faint hover:text-a-text">
                  <AIcon name={show ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </>
          )}
          {state?.error ? (
            <motion.p key={state.error} initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} className="mt-2 flex items-start gap-1.5 text-[12.5px] text-a-danger" role="alert">
              <AIcon name="alert" size={13} className="mt-0.5 shrink-0" /> {state.error}
            </motion.p>
          ) : null}
          <Button type="submit" variant="primary" size="lg" loading={pending} className="mt-4 w-full">
            {codeStep ? t("login.verify") : t("login.signIn")}
          </Button>
        </form>
        <p className="mt-5 text-center text-[12px] text-a-faint">
          <AIcon name="lock" size={12} className="me-1 inline" />
          {codeStep ? t("login.twoFactorOn") : t("login.protected")}
        </p>
      </motion.div>
    </main>
  );
}
