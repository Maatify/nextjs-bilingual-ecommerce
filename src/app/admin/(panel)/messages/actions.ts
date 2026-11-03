"use server";

import { getT } from "@/lib/i18n/admin/server";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { deleteMessages, setMessagesRead } from "@/server/store";

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^m_[a-z0-9]{1,40}$/.test(x)).slice(0, 500) : []);

export async function markMessages(input: string[], read: boolean): Promise<ActionResult<{ updated: number }>> {
  await guard();
  try {
    const list = ids(input);
    if (!list.length) return { ok: false, error: (await getT()).t("sales.errors.nothingSelected") };
    const updated = setMessagesRead(list, read === true);
    return { ok: true, data: { updated } };
  } catch (e) {
    return fail(e);
  }
}

export async function removeMessages(input: string[]): Promise<ActionResult<{ removed: number }>> {
  await guard();
  try {
    const list = ids(input);
    if (!list.length) return { ok: false, error: (await getT()).t("sales.errors.nothingSelected") };
    const removed = deleteMessages(list);
    published(`Deleted ${removed} message${removed === 1 ? "" : "s"}`);
    return { ok: true, data: { removed } };
  } catch (e) {
    return fail(e);
  }
}
