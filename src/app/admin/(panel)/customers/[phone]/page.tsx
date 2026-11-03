import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { notFound } from "next/navigation";
import { CustomerDetailView } from "@/components/admin/sales/customer-detail";
import { getCustomerDetail, requestNow } from "@/server/queries/sales";
import { getSettings } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata({ params }: PageProps<"/admin/customers/[phone]">): Promise<Metadata> {
  const c = getCustomerDetail(decodeURIComponent((await params).phone));
  const { t } = await getT();
  return { title: c ? c.row.name : t("sales.order.customer") };
}

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[phone]">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const detail = getCustomerDetail(decodeURIComponent((await params).phone));
  if (!detail) notFound();
  return <CustomerDetailView detail={detail} storeName={getSettings().site.name} now={requestNow()} />;
}
