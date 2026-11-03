import type { Metadata } from "next";
import { ProductList } from "@/components/admin/catalog/product-list";
import { getT } from "@/lib/i18n/admin/server";
import { productRows } from "@/server/queries/catalog";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("catalog.list.metaTitle") };
}

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { tag } = await searchParams;
  return <ProductList rows={productRows()} initialTag={typeof tag === "string" && tag ? tag : "all"} />;
}
