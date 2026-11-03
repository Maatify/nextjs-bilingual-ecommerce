import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { DraftsList } from "@/components/admin/sales/drafts-list";
import { listOrders } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("sales.drafts.metaTitle") };
}

export default async function DraftsPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  return <DraftsList rows={listOrders({ status: "draft", limit: 500 }).rows} />;
}
