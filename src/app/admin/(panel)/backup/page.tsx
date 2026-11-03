import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { dbInfo } from "@/server/queries/stats";
import { BackupView } from "./backup-view";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("overview.backup.metaTitle") };
}

export default async function BackupPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { locale } = await getT();
  return <BackupView info={dbInfo(locale)} />;
}
