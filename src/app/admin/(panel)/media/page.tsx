import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { MediaLibrary } from "@/components/admin/catalog/media-library";
import { mediaUsage } from "@/server/queries/catalog";
import { listLibrary } from "./actions";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("catalog.media.title") };
}

export default async function MediaPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { t } = await getT();
  const [items, usage] = [await listLibrary(), mediaUsage({ collection: t("catalog.media.useCollection"), hero: t("catalog.media.useHero") })];
  return <MediaLibrary items={items.map((m) => ({ ...m, uses: usage[m.url] ?? [] }))} />;
}
