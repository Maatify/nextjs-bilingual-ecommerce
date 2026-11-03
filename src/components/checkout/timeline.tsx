"use client";

import { useI18n } from "@/components/i18n/provider";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "@/lib/format";

export interface TimelineStep {
  icon: IconName;
  title: string;
  note: string;
}

/** Vertical order-status timeline. Steps before `current` are done; `current` is highlighted. */
export function Timeline({ steps, current, className }: { steps: TimelineStep[]; current: number; className?: string }) {
  const { d } = useI18n();
  return (
    <ol className={cx("relative", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          <li key={s.title} className={cx("relative flex gap-4", !last && "pb-6")} aria-current={active ? "step" : undefined}>
            {!last ? <span className={cx("absolute inset-s-5 top-11 bottom-1 w-0.5 -translate-x-1/2 rtl:translate-x-1/2 rounded-full", done ? "bg-ink" : "bg-ink/10")} aria-hidden /> : null}
            <span
              className={cx(
                "relative z-10 grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                done ? "bg-ink text-white" : active ? "bg-ink text-white ring-4 ring-ink/10" : "bg-surface-2 text-muted",
              )}
            >
              <Icon name={done ? "check" : s.icon} size={18} strokeWidth={done ? 2.2 : 1.6} />
            </span>
            <span className="min-w-0 pt-1">
              <span className={cx("block text-[16px] font-semibold leading-tight", !done && !active && "text-muted")}>{s.title}</span>
              <span className="mt-0.5 block text-[14px] text-muted">{s.note}</span>
              <span className="sr-only">{done ? d.checkout.timeline.complete : active ? d.checkout.timeline.current : d.checkout.timeline.upcoming}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
