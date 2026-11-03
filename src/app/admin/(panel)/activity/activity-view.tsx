"use client";

import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";
import { AIcon } from "@/components/admin/icons";
import { useT } from "@/components/admin/i18n";
import { activityDetail, activityLabel, actorLabel } from "@/components/admin/overview/activity-i18n";
import { activityMeta, type ActivityRow } from "@/components/admin/overview/meta";
import { Card, EmptyState, Input, PageHeader, Tabs, ease } from "@/components/admin/ui";

const TZ = "Africa/Cairo";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

export function ActivityView({ rows, now }: { rows: ActivityRow[]; now: number }) {
  const { t, fmt } = useT();
  const dayTitle = (key: string) => (key === today ? t("common.today") : key === yesterday ? t("common.yesterday") : fmt.date(`${key}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long" }));
  const [q, setQ] = useState("");
  const [actor, setActor] = useState<"all" | "admin" | "system">("all");
  const dq = useDeferredValue(q.trim().toLowerCase());
  const today = dayKey(new Date(now).toISOString());
  const yesterday = dayKey(new Date(now - 864e5).toISOString());

  const groups = useMemo(() => {
    const filtered = rows.filter((r) => (actor === "all" || (actor === "system" ? r.actor !== "admin" : r.actor === "admin")) && (!dq || `${r.action} ${activityLabel(t, r.action)} ${r.target ?? ""} ${r.detail ?? ""} ${r.actor}`.toLowerCase().includes(dq)));
    const map = new Map<string, ActivityRow[]>();
    for (const r of filtered) {
      const k = dayKey(r.at);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows, dq, actor, t]);
  const count = groups.reduce((n, [, g]) => n + g.length, 0);

  return (
    <div>
      <PageHeader title={t("overview.activity.title")} description={t("overview.activity.description")} />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("overview.activity.filter")} aria-label={t("overview.activity.filterLabel")} className="ps-9" />
        </div>
        <Tabs
          value={actor}
          onChange={setActor}
          items={[
            { value: "all", label: t("overview.activity.all") },
            { value: "admin", label: t("overview.activity.admin") },
            { value: "system", label: t("overview.activity.system") },
          ]}
        />
      </div>

      <Card padded={false}>
        {count ? (
          <div className="px-5 py-2">
            <p className="sr-only" aria-live="polite">
              {t("overview.activity.entries", { count })}
            </p>
            <AnimatePresence initial={false} mode="popLayout">
              {groups.map(([key, items], gi) => (
                <motion.section key={key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease, delay: Math.min(gi, 6) * 0.04 }} className="py-3">
                  <h2 className="sticky top-0 z-[1] mb-2 flex items-center gap-2 bg-a-panel py-1.5 text-[12px] font-medium text-a-dim">
                    {dayTitle(key)}
                    <span className="rounded-full bg-a-ink/[0.06] px-1.5 text-[11px] tabular-nums text-a-faint">{items.length}</span>
                  </h2>
                  <ol className="relative before:absolute before:bottom-3 before:start-[15px] before:top-3 before:w-px before:bg-a-line">
                    {items.map((r) => {
                      const m = activityMeta(r.action);
                      return (
                        <motion.li key={r.id} layout="position" className="relative flex gap-3.5 rounded-xl py-2.5 pe-2">
                          <span className="relative grid size-[31px] shrink-0 place-items-center rounded-full border border-a-line bg-a-panel-2" style={{ color: m.color }}>
                            <AIcon name={m.icon} size={15} />
                          </span>
                          <div className="min-w-0 flex-1 pt-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                              <p className="text-[13.5px] leading-snug">
                                <span className="font-medium">{activityLabel(t, r.action)}</span>
                                {r.target ? <span className="text-a-dim"> · {activityDetail(t, r.target)}</span> : null}
                              </p>
                              <span className="text-[12px] tabular-nums text-a-faint">
                                {fmt.time(r.at)} · {actorLabel(t, r.actor)}
                              </span>
                            </div>
                            {r.detail ? <p className="mt-0.5 break-words text-[12.5px] text-a-faint">{activityDetail(t, r.detail)}</p> : null}
                          </div>
                        </motion.li>
                      );
                    })}
                  </ol>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState icon="activity" title={rows.length ? t("overview.activity.noMatch") : t("overview.activity.empty")} description={rows.length ? t("overview.activity.noMatchHint") : t("overview.activity.emptyHint")} />
        )}
      </Card>
    </div>
  );
}
