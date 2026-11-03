"use server";

import { fail, guard, published, type ActionResult } from "@/server/admin";
import { getContent, saveContent } from "@/server/store";
import { getT } from "@/lib/i18n/admin/server";
import type { FaqGroup } from "@/lib/types";

/** FAQ group as edited in the dashboard: English + Arabic on the same row so reorders keep them aligned. */
export interface FaqGroupInput {
  group: string;
  ar?: string;
  items: { q: string; a: string; arQ?: string; arA?: string }[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function saveFaq(groups: FaqGroupInput[]): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!Array.isArray(groups) || groups.length > 50 || groups.some((g) => !Array.isArray(g?.items) || g.items.length > 200)) return { ok: false, error: t("content.errors.faqTooMany") };
    const rows = groups
      .map((g) => ({
        group: str(g.group, 200),
        ar: str(g.ar, 200),
        items: g.items.map((i) => ({ q: str(i?.q, 500), a: str(i?.a, 5000), arQ: str(i?.arQ, 500), arA: str(i?.arA, 5000) })).filter((i) => i.q || i.a),
      }))
      .filter((g) => g.group || g.items.length);
    if (rows.some((g) => !g.group)) return { ok: false, error: t("content.errors.faqGroupName") };
    const half = rows.flatMap((g) => g.items).find((i) => !i.q || !i.a);
    if (half) return { ok: false, error: t("content.errors.faqHalf", { q: half.q || half.a.slice(0, 40) }) };
    const faq: FaqGroup[] = rows.map((g) => ({ group: g.group, items: g.items.map(({ q, a }) => ({ q, a })) }));
    // Arabic FAQ mirrors the English one row-for-row; untranslated rows carry the English text
    // (the storefront swaps the whole list, so it must never be shorter or contain blanks).
    const anyAr = rows.some((g) => g.ar || g.items.some((i) => i.arQ || i.arA));
    const arFaq: FaqGroup[] | undefined = anyAr ? rows.map((g) => ({ group: g.ar || g.group, items: g.items.map((i) => ({ q: i.arQ || i.q, a: i.arA || i.a })) })) : undefined;
    const current = getContent();
    saveContent({ ...current, faq, ar: { ...current.ar, faq: arFaq } });
    published("Updated FAQ", `${faq.reduce((n, g) => n + g.items.length, 0)} questions`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
