import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { listActivity } from "@/server/store";
import { ActivityView } from "./activity-view";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("overview.activity.metaTitle") };
}

export default async function ActivityPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  return <ActivityView rows={listActivity(200)} now={new Date().getTime()} />;
}
