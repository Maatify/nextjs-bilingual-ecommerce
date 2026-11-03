import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { listMessages } from "@/server/store";
import { MessagesView } from "./messages-view";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.messages") };
}
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  return <MessagesView messages={listMessages()} />;
}
