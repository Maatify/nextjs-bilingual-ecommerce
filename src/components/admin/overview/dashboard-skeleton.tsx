"use client";

import { useT } from "@/components/admin/i18n";
import { Skeleton } from "@/components/admin/ui";

/** Route-level loading state for the Overview and Analytics dashboards. */
export function DashboardSkeleton() {
  const { t } = useT();
  return (
    <div aria-busy="true" aria-label={t("overview.loading")}>
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Skeleton className="mb-3 h-3.5 w-40" />
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-72 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[148px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[400px] rounded-2xl" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    </div>
  );
}
