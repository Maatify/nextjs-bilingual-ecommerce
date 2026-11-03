import { Skeleton } from "@/components/admin/ui";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-7 h-4 w-80" />
      <Skeleton className="mb-4 h-9 w-full" />
      <div className="space-y-3 rounded-2xl border border-a-line bg-a-panel p-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
