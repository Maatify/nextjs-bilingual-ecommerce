import { LiveNotifier } from "@/components/admin/live/live-notifier";
import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/server/auth";
import { abandonedTodayCount } from "@/server/queries/checkouts";
import { getDb, listOrders, listProducts, liveStats } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const products = listProducts();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const live = liveStats();
  const counts = {
    openOrders: live.pendingOrders,
    pendingReviews: live.pendingReviews,
    unreadMessages: live.unreadMessages,
    lowStock: products.filter((p) => p.status !== "archived" && p.sizes.some((s) => s.stock <= 3)).length,
    // drafts aren't orders yet — keep them out of the header count
    todayOrders: (getDb().prepare("SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND status != 'draft'").get(today.toISOString()) as { n: number }).n,
    abandonedToday: abandonedTodayCount(),
  };
  const index = {
    products: products.map((p) => ({ id: p.id, title: p.title, image: p.colors[0]?.images[0] ?? "", status: p.status ?? "active" })),
    orders: listOrders({ limit: 60 }).rows.filter((o) => o.status !== "draft").slice(0, 40).map((o) => ({ id: o.id, number: o.number, name: o.customer.name, total: o.totals.total })),
  };
  return (
    <>
      <AdminShell counts={counts} index={index}>
        {children}
      </AdminShell>
      {/* outside the shell so `position: fixed` isn't trapped by the page-transition transform */}
      <LiveNotifier initial={live} />
    </>
  );
}
