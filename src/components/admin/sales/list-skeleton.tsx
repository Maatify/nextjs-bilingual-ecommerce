"use client";

import { useT } from "../i18n";
import { Skeleton } from "../ui";

/** Route-level loading placeholder for sales list pages. */
export function ListSkeleton({ rows = 8, tabs = true }: { rows?: number; tabs?: boolean }) {
  const { t } = useT();
  return (
    <div aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-7 h-4 w-80 max-w-full" />
      {tabs ? <Skeleton className="mb-4 h-10 w-full max-w-[640px] rounded-xl" /> : null}
      <div className="overflow-hidden rounded-2xl border border-a-line bg-a-panel">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-a-line/70 px-4 py-3.5 last:border-0">
            <Skeleton className="size-9 rounded-[9px]" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
