"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ActionResult } from "@/server/admin";
import { useT } from "../i18n";
import { toast } from "../ui";

/**
 * Wraps a server action: tracks `saving`, toasts the outcome and refreshes the
 * route so server data reloads (useDraft then adopts the saved value).
 */
export function useSaver<A extends unknown[], T = undefined>(action: (...args: A) => Promise<ActionResult<T>>, success: string) {
  const router = useRouter();
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const run = async (...args: A): Promise<ActionResult<T>> => {
    setSaving(true);
    try {
      const res = await action(...args);
      if (!res.ok) toast.error(t("common.errors.saveFailed"), res.error);
      else {
        toast.success(success, t("content.liveOnStore"));
        router.refresh();
      }
      return res;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      toast.error(t("common.errors.saveFailed"), error);
      return { ok: false, error };
    } finally {
      setSaving(false);
    }
  };
  return [run, saving] as const;
}
