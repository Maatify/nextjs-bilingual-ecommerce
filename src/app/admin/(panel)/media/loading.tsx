import { Skeleton } from "@/components/admin/ui";
import { getT } from "@/lib/i18n/admin/server";

export default async function Loading() {
  const { t } = await getT();
  return (
    <div aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton className="mb-2 h-8 w-32" />
      <Skeleton className="mb-7 h-4 w-80" />
      <Skeleton className="mb-5 h-28 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
