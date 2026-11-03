import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { AbandonedView } from "@/components/admin/sales/abandoned-view";
import { listCheckouts } from "@/server/queries/checkouts";
import { getSettings } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.abandoned") };
}

export default async function AbandonedCheckoutsPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  return <AbandonedView rows={listCheckouts()} storeName={getSettings().site.name} />;
}
