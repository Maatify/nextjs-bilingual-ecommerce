import type { Metadata } from "next";
import { PagesList } from "@/components/admin/content/pages-list";
import { getT } from "@/lib/i18n/admin/server";
import { pageCompleteness } from "@/lib/i18n/admin/completeness";
import { getContent } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("content.pages.title") };
}

export default async function PagesPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { locale } = await getT();
  const pages = getContent().pages.map((p) => {
    const ar = locale === "ar" && p.ar ? p.ar : undefined;
    return {
      slug: p.slug,
      // in the Arabic dashboard show the Arabic name when there is one
      title: ar?.title ? [ar.title, ar.accent].filter(Boolean).join(" ") : [p.title, p.accent].filter(Boolean).join(" "),
      nav: ar?.nav || p.nav,
      description: ar?.description || p.description,
      sections: p.sections.length,
      published: p.published !== false,
      ar: pageCompleteness(p),
    };
  });
  return <PagesList pages={pages} />;
}
