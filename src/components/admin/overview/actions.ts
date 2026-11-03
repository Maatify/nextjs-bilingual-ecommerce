"use server";

import { revalidatePath } from "next/cache";
import { fail, guard, type ActionResult } from "@/server/admin";
import { setSetupDismissed } from "@/server/queries/setup";

export async function dismissSetupGuide(dismissed: boolean): Promise<ActionResult> {
  await guard();
  try {
    setSetupDismissed(dismissed === true);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
