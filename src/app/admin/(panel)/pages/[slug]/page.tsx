import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageEditor } from "@/components/admin/content/page-editor";
import { getT } from "@/lib/i18n/admin/server";
import { getContent, getSettings } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata({ params }: PageProps<"/admin/pages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = getContent().pages.find((p) => p.slug === slug);
  const { t, locale } = await getT();
  const name = locale === "ar" ? page?.ar?.nav || page?.nav : page?.nav;
  return { title: name ? `${name} · ${t("content.pages.title")}` : t("content.pages.title") };
}

export default async function EditPage({ params }: PageProps<"/admin/pages/[slug]">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const { slug } = await params;
  const page = getContent().pages.find((p) => p.slug === slug);
  if (!page) notFound();
  const site = getSettings().site;
  return <PageEditor saved={JSON.parse(JSON.stringify(page))} site={{ name: site.name, url: site.url }} />;
}
