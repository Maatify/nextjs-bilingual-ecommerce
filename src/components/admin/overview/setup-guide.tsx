"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cx } from "@/lib/format";
import type { SetupStep, SetupStepKey } from "@/server/queries/setup";
import { AIcon, type AIconName } from "../icons";
import { useT } from "../i18n";
import { Button, IconBtn, LinkButton, ease, toast } from "../ui";
import { dismissSetupGuide } from "./actions";

const META: Record<SetupStepKey, { href: string; icon: AIconName }> = {
  products: { href: "/admin/products/new", icon: "products" },
  homepage: { href: "/admin/homepage", icon: "home" },
  shipping: { href: "/admin/settings?tab=shipping", icon: "truck" },
  payments: { href: "/admin/settings?tab=payments", icon: "card" },
  contact: { href: "/admin/settings", icon: "whatsapp" },
  security: { href: "/admin/settings?tab=security", icon: "lock" },
  order: { href: "/admin/orders/new", icon: "orders" },
};

function Ring({ done, total }: { done: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-a-ink/10" />
        <motion.circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" strokeLinecap="round" stroke="url(#setup-grad)" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - done / total) }} transition={{ duration: 0.9, ease }} />
        <defs>
          <linearGradient id="setup-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b74ff" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
        </defs>
      </svg>
      <span dir="ltr" className="text-[12px] font-semibold tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}

function Check({ done }: { done: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className={cx("relative grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-300", done ? "a-grad text-white shadow-[0_4px_14px_-4px_rgb(139_116_255/0.8)]" : "border-[1.5px] border-dashed border-a-line-strong")}>
      <AnimatePresence>
        {done ? (
          <motion.svg key="c" viewBox="0 0 24 24" className="size-3.5" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease, delay: 0.1 }} />
          </motion.svg>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function SetupGuide({ steps, dismissed }: { steps: SetupStep[]; dismissed: boolean }) {
  const router = useRouter();
  const { t, isRtl } = useT();
  const done = steps.filter((s) => s.done).length;
  const firstOpen = steps.find((s) => !s.done)?.key ?? null;
  const [open, setOpen] = useState<SetupStepKey | null>(firstOpen);
  const [hidden, setHidden] = useState(dismissed);
  const [collapsed, setCollapsed] = useState(false);

  const dismiss = async (v: boolean) => {
    setHidden(v);
    const res = await dismissSetupGuide(v);
    if (!res.ok) {
      setHidden(!v);
      return toast.error(t("overview.setup.updateFailed"), res.error);
    }
    if (v) toast.success(t("overview.setup.hidden"), t("overview.setup.hiddenHint"));
    router.refresh();
  };

  if (hidden)
    return (
      <div className="mt-8 flex justify-center">
        <button type="button" onClick={() => dismiss(false)} className="text-[12.5px] text-a-faint transition hover:text-a-text">
          {done < steps.length ? t("overview.setup.showProgress", { done, total: steps.length }) : t("overview.setup.show")}
        </button>
      </div>
    );

  const all = done === steps.length;

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} aria-label={t("overview.setup.label")} className="fx-spot relative mb-5 overflow-hidden rounded-2xl border border-a-line bg-a-panel">
      <div aria-hidden className="pointer-events-none absolute -end-20 -top-24 size-64 rounded-full bg-a-violet/15 blur-3xl" />
      <div className="relative flex items-center gap-4 px-5 py-4">
        <Ring done={done} total={steps.length} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{all ? t("overview.setup.ready") : t("overview.setup.title")}</h2>
          <p className="mt-0.5 text-[12.5px] text-a-dim">{all ? t("overview.setup.readyHint") : t("overview.setup.progress", { count: steps.length - done })}</p>
        </div>
        <IconBtn icon={collapsed ? "chevronDown" : "chevronUp"} label={collapsed ? t("overview.setup.expand") : t("overview.setup.collapse")} onClick={() => setCollapsed((c) => !c)} />
        <IconBtn icon="close" label={t("overview.setup.dismiss")} onClick={() => dismiss(true)} />
      </div>
      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="relative overflow-hidden border-t border-a-line px-2 py-2">
            {steps.map((s, i) => {
              const m = META[s.key];
              const isOpen = open === s.key;
              return (
                <motion.li key={s.key} initial={{ opacity: 0, x: isRtl ? 6 : -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease, delay: 0.04 * i }} className={cx("rounded-xl transition-colors", isOpen && "bg-a-ink/[0.035]")}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.key)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start">
                    <Check done={s.done} />
                    <span className={cx("flex-1 text-[13.5px] transition-colors", s.done ? "text-a-dim line-through decoration-a-faint/50" : "font-medium text-a-text")}>{t(`overview.setup.steps.${s.key}.title`)}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2, ease }} className="grid text-a-faint">
                      <AIcon name="chevronDown" size={15} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
                        <div className="flex flex-col gap-3 ps-12 pe-3 pb-3.5 sm:flex-row sm:items-center">
                          <p className="flex-1 text-[13px] leading-relaxed text-a-dim">{t(`overview.setup.steps.${s.key}.body`)}</p>
                          <LinkButton href={m.href} size="sm" variant={s.done ? "secondary" : "primary"} icon={m.icon}>
                            {s.done ? t("overview.setup.review") : t(`overview.setup.steps.${s.key}.cta`)}
                          </LinkButton>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </motion.ol>
        ) : null}
      </AnimatePresence>
      {all ? (
        <div className="relative flex justify-end border-t border-a-line px-5 py-3">
          <Button size="sm" variant="ghost" onClick={() => dismiss(true)}>
            {t("overview.setup.hide")}
          </Button>
        </div>
      ) : null}
    </motion.section>
  );
}
