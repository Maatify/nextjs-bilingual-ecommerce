import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { TagsManager, type TagRow } from "@/components/admin/catalog/tags-manager";
import { listCollections, listProducts } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("catalog.tags.title") };
}

export default async function TagsPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const products = listProducts();
  const cats = listCollections();
  const map = new Map<string, TagRow>();
  for (const p of products)
    for (const t of p.collections) {
      const r = map.get(t) ?? { tag: t, count: 0, active: 0, images: [], categories: [] };
      r.count++;
      if ((p.status ?? "active") === "active") r.active++;
      if (r.images.length < 4 && p.colors[0]?.images[0]) r.images.push(p.colors[0].images[0]);
      map.set(t, r);
    }
  for (const c of cats) if (c.rule.type === "tag") map.get(c.rule.tag)?.categories.push({ handle: c.handle, title: c.title });
  const rows = [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const orphanCategories = cats.filter((c) => c.rule.type === "tag" && !map.has(c.rule.tag)).map((c) => ({ handle: c.handle, title: c.title, tag: (c.rule as { tag: string }).tag }));
  return <TagsManager rows={rows} orphanCategories={orphanCategories} />;
}
