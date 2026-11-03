import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { notFound } from "next/navigation";
import { Invoice } from "@/components/admin/sales/invoice";
import { offerRules } from "@/components/admin/sales/draft-types";
import { getOrder, getSettings } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("sales.order.invoice") };
}

export default async function InvoicePage({ params }: PageProps<"/admin/orders/[id]/invoice">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const order = getOrder(decodeURIComponent((await params).id));
  if (!order) notFound();
  const settings = getSettings();
  return <Invoice order={order} site={settings.site} multiBuy={offerRules(settings.offer).multi} />;
}
