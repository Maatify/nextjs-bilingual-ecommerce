import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/catalog/product-editor";
import { catalogOptions, unitsSoldByProduct } from "@/server/queries/catalog";
import { getT } from "@/lib/i18n/admin/server";
import { getProduct } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata({ params }: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { t, locale } = await getT();
  const p = getProduct(id);
  return { title: (locale === "ar" ? p?.ar?.title || p?.title : p?.title) ?? t("products.meta.product") };
}

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();
  return <ProductEditor key={product.id} product={product} isNew={false} options={catalogOptions()} sold={unitsSoldByProduct()[product.id] ?? 0} />;
}
