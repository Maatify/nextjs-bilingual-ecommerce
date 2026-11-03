"use client";

import { useT } from "./i18n";
import { Skeleton } from "./ui";

/**
 * Route-level loading placeholders (loading.tsx) for the force-dynamic dashboard pages, so a click gets
 * instant feedback — the page shell swaps to this skeleton in the same frame while the server renders.
 * Shapes roughly follow each page so the real content lands without a big jump.
 */
export function PageSkeleton({ variant }: { variant: "overview" | "detail" | "form" | "editor" | "list" }) {
  const { t } = useT();
  return (
    <div aria-busy="true" aria-label={t("common.loading")}>
      {variant === "detail" || variant === "editor" ? <Skeleton className="mb-3 h-4 w-24" /> : null}
      <Skeleton className="mb-2 h-8 w-56 max-w-full" />
      <Skeleton className="mb-7 h-4 w-80 max-w-full" />
      {variant === "overview" ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[118px] rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </>
      ) : variant === "detail" || variant === "editor" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className={variant === "editor" ? "h-80 rounded-2xl" : "h-48 rounded-2xl"} />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      ) : variant === "form" ? (
        <>
          <Skeleton className="mb-5 h-10 w-full max-w-[560px] rounded-xl" />
          <div className="max-w-[860px] space-y-5">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-a-line bg-a-panel">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-a-line/70 px-4 py-3.5 last:border-0">
              <Skeleton className="size-9 rounded-[9px]" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="ms-auto h-3.5 w-20" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
