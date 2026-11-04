"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AIcon } from "@/components/admin/icons";
import { Ltr, useT } from "@/components/admin/i18n";
import { Badge, Button, Card, ConfirmButton, ease, Field, Input, Skeleton, table, toast } from "@/components/admin/ui";
import type { TFn } from "@/lib/i18n/admin";
import { cx } from "@/lib/format";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/server/security/strength";
import {
  changePasswordAction,
  confirmTwoFactor,
  disableTwoFactor,
  getSecurityOverview,
  newRecoveryCodes,
  revokeSessionAction,
  signOutEverywhere,
  startTwoFactor,
  type SecurityOverview,
} from "./actions";

/** "Chrome on macOS" (from describeUA) → "Chrome على macOS". */
function deviceLabel(t: TFn, d: string) {
  if (d === "Unknown device") return t("content.security.unknownDevice");
  const m = /^(.+?) on (.+)$/.exec(d);
  return m ? t("content.security.deviceOn", { browser: m[1], os: m[2] }) : d;
}

const PROTECTIONS = ["hash", "lockout", "log", "expiry", "cookies", "headers", "limits", "dupes"] as const;

/** Settings → Security: password, two-factor auth, active sessions. Loads its own data via server actions. */
export function SecurityPanel() {
  const { t } = useT();
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    getSecurityOverview()
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(reload, [reload]);

  if (error) return <Card title={t("content.security.title")}>{t("content.security.loadFailed")}</Card>;
  if (!data)
    return (
      <div className="grid items-start gap-5 lg:grid-cols-2" aria-busy="true">
        <Skeleton className="h-[380px] rounded-2xl" />
        <Skeleton className="h-[380px] rounded-2xl" />
      </div>
    );

  return (
    <div className="space-y-5">
      {data.password.weak ? (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} role="alert" className="flex items-start gap-3 rounded-2xl border border-a-warn/30 bg-a-warn/10 p-4 text-[13px] leading-relaxed">
          <AIcon name="alert" size={18} className="mt-0.5 shrink-0 text-a-warn" />
          <div>
            <p className="font-semibold text-a-text">{t("content.security.weakTitle")}</p>
            <p className="text-a-dim">{t("content.security.weakBody")}</p>
          </div>
        </motion.div>
      ) : null}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <PasswordCard info={data.password} onChanged={reload} />
        <TwoFactorCard state={data.twoFactor} onChanged={reload} />
      </div>
      <SessionsCard sessions={data.sessions} onChanged={reload} />
      <Card title={t("content.security.builtIn")} description={t("content.security.builtInDesc")}>
        <ul className="grid gap-x-6 gap-y-2.5 text-[13px] text-a-dim sm:grid-cols-2">
          {PROTECTIONS.map((k) => (
            <li key={k} className="flex items-start gap-2">
              <AIcon name="check" size={14} className="mt-0.5 shrink-0 text-a-ok" />
              {t(`content.security.protections.${k}`)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ───────────── password ───────────── */

const METER = ["bg-a-danger", "bg-a-danger", "bg-a-warn", "bg-a-ok", "bg-a-ok"];

function PasswordCard({ info, onChanged }: { info: SecurityOverview["password"]; onChanged: () => void }) {
  const { t, fmt } = useT();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState<{ field?: string; error: string } | null>(null);
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const st = passwordStrength(f.next);
  const mismatch = f.confirm.length > 0 && f.confirm !== f.next;
  const canSubmit = f.current && f.next.length >= MIN_PASSWORD_LENGTH && st.score >= 2 && f.next === f.confirm;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await changePasswordAction(f.current, f.next, f.confirm);
      if (!r.ok) {
        setErr({ field: r.field, error: r.error });
        return;
      }
      setErr(null);
      setF({ current: "", next: "", confirm: "" });
      toast.success(t("content.security.changed"), t("content.security.changedDesc"));
      onChanged();
    });
  };

  return (
    <Card title={t("content.security.password")} description={info.changedAt ? t(info.source === "env" ? "content.security.lastChangedEnv" : "content.security.lastChanged", { ago: fmt.ago(info.changedAt) }) : t("content.security.fromEnv")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
        <Field label={t("content.security.current")} htmlFor="pw-current" error={err?.field === "current" ? err.error : null}>
          <Input id="pw-current" type={show ? "text" : "password"} autoComplete="current-password" maxLength={256} value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        </Field>
        <Field
          label={t("content.security.next")}
          htmlFor="pw-next"
          error={err?.field === "next" ? err.error : null}
          aside={
            <button type="button" onClick={() => setShow((s) => !s)} className="text-[12px] text-a-dim hover:text-a-text">
              {show ? t("content.security.hide") : t("content.security.show")}
            </button>
          }
        >
          <Input id="pw-next" type={show ? "text" : "password"} autoComplete="new-password" maxLength={256} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} aria-describedby="pw-meter" />
          <div id="pw-meter" className="mt-2" aria-live="polite">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-a-ink/[0.08]">
                  <motion.span className={cx("block h-full rounded-full", METER[st.score])} initial={false} animate={{ width: f.next && (st.score > i || (i === 0 && f.next)) ? "100%" : "0%" }} transition={{ duration: 0.3, ease }} />
                </span>
              ))}
            </div>
            {f.next ? (
              <p className="mt-1.5 text-[12px] text-a-faint">
                <span className={cx("font-medium", st.score >= 3 ? "text-a-ok" : st.score === 2 ? "text-a-warn" : "text-a-danger")}>{t(`content.security.strength.s${st.score}`)}</span>
                {st.code ? ` — ${t(`content.security.hints.${st.code}`, { min: MIN_PASSWORD_LENGTH })}` : ""}
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-a-faint">{t("content.security.minHint", { min: MIN_PASSWORD_LENGTH })}</p>
            )}
          </div>
        </Field>
        <Field label={t("content.security.confirm")} htmlFor="pw-confirm" error={err?.field === "confirm" ? err.error : mismatch ? t("content.security.mismatch") : null}>
          <Input id="pw-confirm" type={show ? "text" : "password"} autoComplete="new-password" maxLength={256} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        </Field>
        {err && !err.field ? (
          <p className="text-[12.5px] text-a-danger" role="alert">
            {err.error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-a-faint">{t("content.security.otherDevices")}</p>
          <Button type="submit" variant="primary" loading={pending} disabled={!canSubmit}>
            {t("content.security.change")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ───────────── two-factor ───────────── */

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useT();
  const text = `VEDRA admin recovery codes\nEach code works once.\n\n${codes.join("\n")}\n`;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease }} className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl border border-a-warn/30 bg-a-warn/10 p-3 text-[12.5px] leading-relaxed text-a-dim">
        <AIcon name="alert" size={15} className="mt-0.5 shrink-0 text-a-warn" />
        {t("content.security.recoverySave")}
      </p>
      <ol dir="ltr" className="grid grid-cols-2 gap-2 rounded-xl border border-a-line bg-a-panel-2/60 p-3 font-mono text-[13px] tracking-wide">
        {codes.map((c) => (
          <li key={c} className="select-all">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon="copy"
          onClick={() =>
            navigator.clipboard.writeText(codes.join("\n")).then(
              () => toast.success(t("common.copied")),
              () => toast.error(t("content.security.copyFailed")),
            )
          }
        >
          {t("common.copy")}
        </Button>
        <Button
          size="sm"
          icon="download"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            a.download = "vedra-recovery-codes.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }}
        >
          {t("common.download")}
        </Button>
        <Button size="sm" variant="primary" className="ms-auto" onClick={onDone}>
          {t("content.security.saved")}
        </Button>
      </div>
    </motion.div>
  );
}

function TwoFactorCard({ state, onChanged }: { state: SecurityOverview["twoFactor"]; onChanged: () => void }) {
  const { t } = useT();
  const [setup, setSetup] = useState<{ secret: string; url: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"idle" | "disable" | "regen">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      const r = await startTwoFactor();
      if (r.ok && r.data) {
        setSetup(r.data);
        setErr(null);
      } else if (!r.ok) setErr(r.error);
    });
  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await confirmTwoFactor(code);
      if (!r.ok) return setErr(r.error);
      setSetup(null);
      setCode("");
      setErr(null);
      setCodes(r.data!.codes);
      toast.success(t("content.security.turnedOn"));
    });
  };
  const disable = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await disableTwoFactor(pw, code);
      if (!r.ok) return setErr(r.error);
      setMode("idle");
      setPw("");
      setCode("");
      setErr(null);
      toast.info(t("content.security.turnedOff"));
      onChanged();
    });
  };
  const regen = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await newRecoveryCodes(pw);
      if (!r.ok) return setErr(r.error);
      setMode("idle");
      setPw("");
      setErr(null);
      setCodes(r.data!.codes);
    });
  };
  const cancel = () => {
    setMode("idle");
    setSetup(null);
    setPw("");
    setCode("");
    setErr(null);
  };

  const groups = setup?.secret.match(/.{1,4}/g)?.join(" ");

  return (
    <Card
      title={t("content.security.twoFactor")}
      description={t("content.security.twoFactorDesc")}
      actions={state.enabled ? <Badge tone="green" dot>{t("content.security.on")}</Badge> : <Badge tone="amber" dot>{t("content.security.off")}</Badge>}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={codes ? "codes" : setup ? "setup" : mode + String(state.enabled)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }}>
          {codes ? (
            <RecoveryCodes
              codes={codes}
              onDone={() => {
                setCodes(null);
                onChanged();
              }}
            />
          ) : setup ? (
            <form onSubmit={confirm} className="space-y-4">
              <ol className="list-decimal space-y-3 ps-5 text-[13px] leading-relaxed text-a-dim">
                <li>
                  {t("content.security.step1")} <b className="font-medium text-a-text">{t("content.security.step1Key")}</b>:
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-a-line bg-a-panel-2/60 p-2.5 ps-3" dir="ltr">
                    <code className="min-w-0 flex-1 break-all font-mono text-[13px] tracking-wide text-a-text select-all">{groups}</code>
                    <Button type="button" size="xs" icon="copy" onClick={() => navigator.clipboard.writeText(setup.secret).then(() => toast.success(t("content.security.keyCopied")), () => undefined)}>
                      {t("common.copy")}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[12px] text-a-faint">
                    {t("content.security.account")}{" "}
                    <a href={setup.url} className="text-a-accent underline underline-offset-2">
                      {t("content.security.openLink")}
                    </a>
                    .
                  </p>
                </li>
                <li>{t("content.security.step2")}</li>
              </ol>
              <Field htmlFor="totp-code" error={err}>
                <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" className="h-11 font-mono text-[17px] tracking-[0.3em]" autoFocus />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={cancel}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant="primary" loading={pending} disabled={code.replace(/\s/g, "").length !== 6}>
                  {t("content.security.verifyOn")}
                </Button>
              </div>
            </form>
          ) : mode !== "idle" ? (
            <form onSubmit={mode === "disable" ? disable : regen} className="space-y-4">
              <Field label={t("login.password")} htmlFor="tf-pw">
                <Input id="tf-pw" type="password" autoComplete="current-password" maxLength={256} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              </Field>
              {mode === "disable" ? (
                <Field label={t("content.security.currentCode")} htmlFor="tf-code">
                  <Input id="tf-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" className="font-mono tracking-[0.2em]" />
                </Field>
              ) : null}
              {err ? (
                <p className="text-[12.5px] text-a-danger" role="alert">
                  {err}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={cancel}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant={mode === "disable" ? "danger" : "primary"} loading={pending} disabled={!pw || (mode === "disable" && code.replace(/\s/g, "").length !== 6)}>
                  {mode === "disable" ? t("content.security.turnOff2fa") : t("content.security.generate")}
                </Button>
              </div>
            </form>
          ) : state.enabled ? (
            <div className="space-y-4 text-[13px] text-a-dim">
              <p className="flex items-center gap-2">
                <AIcon name="lock" size={15} className="text-a-ok" />
                {t("content.security.requires")}
              </p>
              <p className={cx(state.recoveryLeft <= 2 && "text-a-warn")}>{t("content.security.recoveryLeft", { left: state.recoveryLeft })}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon="refresh" onClick={() => setMode("regen")}>
                  {t("content.security.newCodes")}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setMode("disable")}>
                  {t("content.security.turnOff")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-[13px] leading-relaxed text-a-dim">
              <p>{t("content.security.pitch")}</p>
              {err ? (
                <p className="text-[12.5px] text-a-danger" role="alert">
                  {err}
                </p>
              ) : null}
              <Button variant="primary" icon="lock" loading={pending} onClick={begin}>
                {t("content.security.setup")}
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

/* ───────────── sessions ───────────── */

function SessionsCard({ sessions, onChanged }: { sessions: SecurityOverview["sessions"]; onChanged: () => void }) {
  const { t, fmt } = useT();
  return (
    <Card
      title={t("content.security.sessions")}
      description={t("content.security.sessionsDesc")}
      padded={false}
      actions={
        <ConfirmButton icon="logout" variant="secondary" confirmLabel={t("content.security.signOutAllConfirm")} onConfirm={() => signOutEverywhere()}>
          {t("content.security.signOutAll")}
        </ConfirmButton>
      }
    >
      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={cx(table.th, "text-start")}>{t("content.security.device")}</th>
              <th className={cx(table.th, "text-start")}>{t("content.security.ip")}</th>
              <th className={cx(table.th, "text-start")}>{t("content.security.signedIn")}</th>
              <th className={cx(table.th, "text-start")}>{t("content.security.lastActive")}</th>
              <th className={cx(table.th, "text-end")}>
                <span className="sr-only">{t("common.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className={table.tr}>
                <td className={table.td}>
                  <span className="flex items-center gap-2 font-medium">
                    {deviceLabel(t, s.device)}
                    {s.current ? <Badge tone="violet">{t("content.security.thisDevice")}</Badge> : null}
                  </span>
                </td>
                <td className={cx(table.td, "font-mono text-[12.5px] text-a-dim")}><Ltr>{s.ip || "—"}</Ltr></td>
                <td className={cx(table.td, "text-a-dim")} title={fmt.dateTime(s.createdAt)}>
                  {fmt.ago(s.createdAt)}
                </td>
                <td className={cx(table.td, "text-a-dim")} title={fmt.dateTime(s.lastSeen)}>
                  {s.current ? t("content.security.now") : fmt.ago(s.lastSeen)}
                </td>
                <td className={cx(table.td, "text-end")}>
                  {s.current ? null : (
                    <ConfirmButton
                      icon="close"
                      confirmLabel={t("content.security.revokeConfirm")}
                      onConfirm={async () => {
                        const r = await revokeSessionAction(s.id);
                        if (r.ok) toast.success(t("content.security.revoked"));
                        else toast.error(r.error);
                        onChanged();
                      }}
                    >
                      {t("content.security.revoke")}
                    </ConfirmButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
