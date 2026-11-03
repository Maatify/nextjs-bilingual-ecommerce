"use client";

import { FX_BOOT_SCRIPT } from "./boot";

/**
 * Pre-paint inline script (see boot.ts). In the server HTML it is a normal script and runs before the
 * body paints; when React renders it on the client it becomes an inert data block (never re-executed,
 * and React doesn't warn about script tags in components).
 */
export function FxBoot() {
  return <script suppressHydrationWarning type={typeof window === "undefined" ? undefined : "text/x-fx-boot"} dangerouslySetInnerHTML={{ __html: FX_BOOT_SCRIPT }} />;
}
