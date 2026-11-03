import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { InventoryGrid, type InventoryItem } from "@/components/admin/catalog/inventory-grid";
import { normalizeVariants } from "@/lib/variants";
import { listProducts } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("catalog.inventory.title") };
}

export default async function InventoryPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const items: InventoryItem[] = listProducts().map((raw) => {
    const p = normalizeVariants(raw);
    return {
      id: p.id,
      title: p.title,
      image: p.colors[0]?.images[0] ?? "",
      status: p.status ?? "active",
      sku: p.sku,
      category: p.category,
      tracked: p.trackQuantity !== false,
      colors: p.colors.map((c) => ({ name: c.name, hex: c.hex, image: c.images[0] ?? "" })),
      variants: (p.variants ?? []).map((v) => ({ color: v.color, size: v.size, stock: v.stock, sku: v.sku })),
    };
  });
  return <InventoryGrid items={items} />;
}
