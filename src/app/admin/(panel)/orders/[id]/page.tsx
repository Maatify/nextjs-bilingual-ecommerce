import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { notFound, redirect } from "next/navigation";
import { OrderDetail } from "@/components/admin/sales/order-detail";
import { offerRules } from "@/components/admin/sales/draft-types";
import { customerOrderCount } from "@/server/queries/sales";
import { getOrder, getReviewSettings, getSettings, listReviews } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const o = getOrder((await params).id);
  const { t } = await getT();
  return { title: o ? t("sales.order.metaTitle", { number: o.number }) : t("sales.order.metaFallback") };
}

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const order = getOrder(decodeURIComponent((await params).id));
  if (!order) notFound();
  if (order.status === "draft") redirect(`/admin/orders/new?draft=${encodeURIComponent(order.id)}`);
  const settings = getSettings();
  return (
    <OrderDetail
      order={order}
      pastOrders={customerOrderCount(order.customer.phone)}
      storeName={settings.site.name}
      governorates={settings.governorates.map((g) => g.name)}
      multiBuy={offerRules(settings.offer).multi}
      review={{ received: listReviews().filter((r) => r.orderId === order.id).length, prompt: getReviewSettings().requestPrompt }}
    />
  );
}
