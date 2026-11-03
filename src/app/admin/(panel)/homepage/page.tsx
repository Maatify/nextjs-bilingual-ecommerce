import type { Metadata } from "next";
import { HomepageEditor } from "@/components/admin/content/homepage-editor";
import { getT } from "@/lib/i18n/admin/server";
import { linkTargets, productOptions } from "@/server/queries/content";
import { getContent } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("content.home.title") };
}

export default async function HomepagePage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const content = getContent();
  const a = content.ar ?? {};
  const ar = { hero: a.hero, editTitle: a.editTitle, setTitle: a.setTitle, colourStoryTitle: a.colourStoryTitle, ribbons: a.ribbons };
  // JSON round-trip drops undefined keys so useDraft's dirty check compares like with like
  return <HomepageEditor saved={JSON.parse(JSON.stringify({ home: content.home, ribbons: content.ribbons, ar }))} targets={linkTargets()} products={productOptions()} />;
}
