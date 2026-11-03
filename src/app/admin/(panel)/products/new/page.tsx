import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/catalog/product-editor";
import type { Product } from "@/lib/types";
import { getT } from "@/lib/i18n/admin/server";
import { catalogOptions } from "@/server/queries/catalog";
import { newProductId } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("products.meta.newProduct") };
}

export default async function NewProductPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const options = catalogOptions();
  const product: Product = {
    id: newProductId(),
    handle: "",
    title: "",
    tagline: "",
    description: "",
    category: options.categories[0] ?? "",
    gender: "unisex",
    collections: [],
    price: 0,
    colors: [{ name: "Black", hex: "#1c1c1e", images: [] }],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"].map((label) => ({ label, stock: 0 })),
    rating: 0,
    reviewCount: 0,
    fit: "true",
    fitSplit: [10, 80, 10],
    sizeChart: "tops",
    material: "",
    care: ["Machine wash cold, inside out", "Do not tumble dry"],
    ar: { care: ["اغسله مقلوبًا بماء بارد", "لا تستخدم المجفف"] },
    highlights: [],
    sold24h: 0,
    status: "draft",
  };
  return <ProductEditor product={product} isNew options={options} />;
}
