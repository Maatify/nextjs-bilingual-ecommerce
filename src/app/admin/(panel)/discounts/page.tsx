import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { DiscountsView } from "@/components/admin/sales/discounts-view";
import { getReviewSettings, listProducts, getSettings } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.discounts") };
}

export default async function DiscountsPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const s = getSettings();
  const active = listProducts().filter((p) => (p.status ?? "active") === "active");
  const samplePrice = active.length ? Math.round(active.reduce((n, p) => n + p.price, 0) / active.length / 10) * 10 : 650;
  return <DiscountsView promoCodes={s.promoCodes} offer={s.offer} samplePrice={samplePrice} today={new Date().toISOString().slice(0, 10)} reviewReward={getReviewSettings().reward} />;
}
