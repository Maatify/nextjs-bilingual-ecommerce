"use client";

import { hydrateSnapshot } from "@/lib/data";
import type { StoreSnapshot } from "@/lib/types";

/** Hands the server's store snapshot to client components before any of them render. */
export function StoreDataProvider({ snapshot, children }: { snapshot: StoreSnapshot; children: React.ReactNode }) {
  hydrateSnapshot(snapshot);
  return children;
}
