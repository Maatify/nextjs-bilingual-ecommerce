import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import { logActivity } from "./store";

/*
 * Helpers for admin server actions:
 *   "use server";
 *   export async function saveThing(input) {
 *     await guard();
 *     ...write via src/server/store.ts...
 *     published("Updated thing", name);
 *     return { ok: true };
 *   }
 */

export const guard = requireAdmin;

/** Log the change and regenerate every storefront page so it goes live immediately. */
export function published(action: string, target?: string, detail?: string) {
  logActivity(action, target, detail);
  revalidatePath("/", "layout");
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}
