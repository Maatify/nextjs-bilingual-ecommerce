import { Skeleton } from "@/components/admin/ui";
import { getT } from "@/lib/i18n/admin/server";

export default async function Loading() {
  const { t } = await getT();
  return (
    <div aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton className="mb-2 h-8 w-44" />
      <Skeleton className="mb-7 h-4 w-80" />
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Skeleton className="h-[480px] rounded-2xl" />
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
