import "@/server/boot";
import type { Metadata } from "next";
import { TrackForm } from "@/components/checkout/track-form";
import { asLocale, fmt, ogLocale } from "@/lib/i18n/store/config";
import { getDict, getI18n } from "@/lib/i18n/store/server";
import { alternatesFor } from "@/lib/seo";
import { getSite } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/track-order">): Promise<Metadata> {
  const locale = asLocale((await params).lang);
  const m = getDict(locale).checkout.meta;
  return {
    title: m.track,
    description: fmt(m.trackDescription, { store: getSite().name }),
    alternates: alternatesFor("/track-order", locale),
    // a per-customer lookup form — nothing to rank; kept crawlable (not in robots.txt) so the noindex is seen
    robots: { index: false, follow: true },
    openGraph: { locale: ogLocale(locale) },
  };
}

export default async function TrackOrderPage() {
  const { d } = await getI18n();
  return (
    <div className="container-x max-w-[880px] pb-16 pt-8 md:pt-14">
      <h1 className="text-poster">{d.checkout.track.title}</h1>
      <p className="mb-6 mt-3 text-[16px] text-ink-2 md:mb-8">{d.checkout.track.intro}</p>
      <TrackForm />
    </div>
  );
}
