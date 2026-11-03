import { Skeleton } from "@/components/admin/ui";
import { getT } from "@/lib/i18n/admin/server";

export default async function Loading() {
  const { t } = await getT();
  return (
    <div aria-busy="true" aria-label={t("common.loading")}>
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-7 h-4 w-96" />
      <Skeleton className="mb-4 h-10 w-full max-w-xl" />
      <Skeleton className="h-[420px] rounded-2xl" />
    </div>
  );
}
