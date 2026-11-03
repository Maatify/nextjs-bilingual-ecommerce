import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { analyticsStats, parseAnalyticsRange } from "@/server/queries/stats";
import { AnalyticsView } from "./analytics-view";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("overview.analytics.metaTitle") };
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const sp = await searchParams;
  const { locale } = await getT();
  const range = parseAnalyticsRange(Array.isArray(sp.range) ? sp.range[0] : sp.range);
  return <AnalyticsView data={analyticsStats(range, locale)} />;
}
