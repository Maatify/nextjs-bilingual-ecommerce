import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { ReviewsView } from "@/components/admin/sales/reviews-view";
import { getReviewSettings, listOrders, listProducts, listReviews } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.reviews") };
}

export default async function ReviewsPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const products = listProducts().map((p) => ({ id: p.id, title: p.title, image: p.colors[0]?.images[0] ?? "", sizes: p.sizes.map((s) => s.label) }));
  const reviews = listReviews().sort((a, b) => b.date.localeCompare(a.date));
  // delivered orders nobody has asked for a review yet (no review from them, request not marked sent)
  const reviewed = new Set(reviews.map((r) => r.orderId).filter(Boolean));
  const requests = listOrders({ status: "delivered", limit: 500 })
    .rows.filter((o) => !o.demo && !o.reviewRequestSentAt && !reviewed.has(o.id))
    .map((o) => ({
      id: o.id,
      number: o.number,
      name: o.customer.name,
      deliveredAt: [...o.timeline].reverse().find((e) => e.status === "delivered")?.at ?? o.createdAt,
      items: o.totals.itemCount,
      image: o.lines[0]?.image ?? "",
      requestedAt: o.reviewRequestedAt,
    }))
    .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
  return <ReviewsView reviews={reviews} products={products} today={new Date().toISOString().slice(0, 10)} requests={requests} requestPrompt={getReviewSettings().requestPrompt} />;
}
