import { Skeleton } from "@/components/admin/ui";
import { getT } from "@/lib/i18n/admin/server";

export default async function Loading() {
  const { t } = await getT();
  return (
    <div aria-busy="true" aria-label={t("products.loading")}>
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-7 h-8 w-72" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
