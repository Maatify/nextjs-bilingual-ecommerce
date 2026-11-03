import type { Metadata } from "next";
import { SettingsView, type SettingsTab } from "@/components/admin/content/settings-view";
import { getT } from "@/lib/i18n/admin/server";
import { productOptions } from "@/server/queries/content";
import { getContent, getSettings } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("content.settings.title") };
}

const TABS: SettingsTab[] = ["store", "shipping", "payments", "checkout", "popups", "security"];

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { tab } = await searchParams;
  const t = (TABS as string[]).includes(String(tab)) ? (tab as SettingsTab) : "store";
  const s = getSettings();
  const saved = { site: s.site, governorates: s.governorates, shipping: s.offer.shipping, payments: s.payments, checkout: s.checkout, popups: getContent().popups };
  return <SettingsView tab={t} saved={saved} products={productOptions()} cutoffHour={s.offer.cutoffHour} freeShippingAt={s.offer.freeShippingAt} />;
}
