import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { OrdersList } from "@/components/admin/sales/orders-list";
import { ordersPage, parseOrderFilters } from "@/server/queries/sales";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.orders") };
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const filters = parseOrderFilters(await searchParams);
  const data = ordersPage(filters);
  return <OrdersList filters={filters} {...data} />;
}
