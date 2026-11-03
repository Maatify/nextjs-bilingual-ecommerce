import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { CustomersView } from "@/components/admin/sales/customers-view";
import { listCustomers, requestNow } from "@/server/queries/sales";
import { listSubscribers } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.customers") };
}

export default async function CustomersPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  return <CustomersView customers={listCustomers()} subscribers={listSubscribers()} now={requestNow()} />;
}
