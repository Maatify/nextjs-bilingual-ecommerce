"use server";

import { getT } from "@/lib/i18n/admin/server";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { CHECKOUT_ID, deleteCheckouts, getCheckout, markReminded } from "@/server/queries/checkouts";
import { revalidatePath } from "next/cache";

const idList = (ids: unknown): string[] | null => (Array.isArray(ids) && ids.length <= 500 && ids.every((id) => typeof id === "string" && CHECKOUT_ID.test(id)) ? ids : null);

/** Called when the merchant opens the WhatsApp recovery message. */
export async function recordReminder(id: string): Promise<ActionResult<string>> {
  await guard();
  try {
    const { t } = await getT();
    if (typeof id !== "string" || !CHECKOUT_ID.test(id)) return { ok: false, error: t("sales.errors.invalidCheckout") };
    const s = markReminded(id);
    if (!s) return { ok: false, error: t("sales.errors.checkoutNotFound") };
    published("Sent checkout recovery", s.customer.name || s.customer.phone || s.customer.email || id);
    return { ok: true, data: s.remindedAt };
  } catch (e) {
    return fail(e);
  }
}

export async function removeCheckouts(ids: string[]): Promise<ActionResult<number>> {
  await guard();
  try {
    const list = idList(ids);
    if (!list) return { ok: false, error: (await getT()).t("sales.errors.invalidSelectionShort") };
    const single = list.length === 1 ? getCheckout(list[0]) : null;
    const n = deleteCheckouts(list);
    published(`Deleted ${n} abandoned checkout${n === 1 ? "" : "s"}`, single?.customer.name || undefined);
    revalidatePath("/admin", "layout");
    return { ok: true, data: n };
  } catch (e) {
    return fail(e);
  }
}
