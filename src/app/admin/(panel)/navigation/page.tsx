import type { Metadata } from "next";
import { NavigationEditor } from "@/components/admin/content/navigation-editor";
import { getT } from "@/lib/i18n/admin/server";
import { linkTargets } from "@/server/queries/content";
import { getContent } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("content.nav.title") };
}

export default async function NavigationPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const c = getContent();
  const a = c.ar ?? {};
  const tr = (en: string, ar: string | undefined) => (ar && ar.trim() && ar !== en ? ar : undefined);
  const saved = {
    nav: c.nav.map((l, i) => ({ ...l, ar: tr(l.label, a.nav?.[i]) })),
    footer: c.footer.map((col, i) => ({ title: col.title, ar: tr(col.title, a.footer?.[i]?.title), links: col.links.map((l, j) => ({ ...l, ar: tr(l.label, a.footer?.[i]?.links?.[j]) })) })),
    // untranslated announcement rows are stored with the English label (storefront swaps the list) — show them as empty
    announcement: c.announcement.map((l, i) => ({ ...l, ar: tr(l.label, a.announcement?.[i]?.label) })),
  };
  return <NavigationEditor saved={JSON.parse(JSON.stringify(saved))} targets={linkTargets()} />;
}
