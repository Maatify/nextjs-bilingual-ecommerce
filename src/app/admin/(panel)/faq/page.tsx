import type { Metadata } from "next";
import { FaqEditor } from "@/components/admin/content/faq-editor";
import { getT } from "@/lib/i18n/admin/server";
import { getContent } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("content.faq.title") };
}

export default async function FaqPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const c = getContent();
  const arFaq = c.ar?.faq;
  // untranslated Arabic rows are stored with the English text (see saveFaq) — surface them as empty
  const tr = (en: string, ar: string | undefined) => (ar && ar.trim() && ar !== en ? ar : undefined);
  const saved = c.faq.map((g, gi) => ({
    group: g.group,
    ar: tr(g.group, arFaq?.[gi]?.group),
    items: g.items.map((it, ii) => ({ q: it.q, a: it.a, arQ: tr(it.q, arFaq?.[gi]?.items[ii]?.q), arA: tr(it.a, arFaq?.[gi]?.items[ii]?.a) })),
  }));
  return <FaqEditor saved={JSON.parse(JSON.stringify(saved))} />;
}
