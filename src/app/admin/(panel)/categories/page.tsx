import type { Metadata } from "next";
import { CategoriesManager } from "@/components/admin/catalog/categories-manager";
import { catalogOptions, pickProducts } from "@/server/queries/catalog";
import { getT } from "@/lib/i18n/admin/server";
import { listCollections } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("catalog.categories.title") };
}

export default async function CategoriesPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { tags } = catalogOptions();
  return <CategoriesManager categories={listCollections()} products={pickProducts()} tags={tags} />;
}
