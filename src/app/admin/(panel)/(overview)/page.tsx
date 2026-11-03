import type { Metadata } from "next";
import { Overview } from "@/components/admin/overview/overview";
import { SetupGuide } from "@/components/admin/overview/setup-guide";
import { getT } from "@/lib/i18n/admin/server";
import { setupDismissed, setupSteps } from "@/server/queries/setup";
import { overviewStats, parseRange } from "@/server/queries/stats";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("overview.metaTitle") };
}

const TZ = "Africa/Cairo";

export default async function OverviewPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const sp = await searchParams;
  const { t, fmt, locale } = await getT();
  const range = parseRange(Array.isArray(sp.range) ? sp.range[0] : sp.range, "30d");
  const data = overviewStats(range, locale);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
  const greeting = t(hour < 5 ? "overview.greeting.late" : hour < 12 ? "overview.greeting.morning" : hour < 17 ? "overview.greeting.afternoon" : "overview.greeting.evening");
  const dateLabel = fmt.date(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const steps = setupSteps();
  const dismissed = setupDismissed();
  const guide = <SetupGuide key="setup-guide" steps={steps} dismissed={dismissed} />;
  return <Overview data={data} greeting={greeting} dateLabel={dateLabel} top={dismissed ? null : guide} bottom={dismissed ? guide : null} />;
}
