import { Skeleton } from "@/components/admin/ui";
import { getT } from "@/lib/i18n/admin/server";

export default async function Loading() {
  const { t } = await getT();
  return (
    <div aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-7 h-4 w-80" />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="ms-auto h-10 w-64" />
      </div>
      <div className="space-y-px overflow-hidden rounded-2xl border border-a-line bg-a-panel">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-12 w-[38px]" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ms-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
