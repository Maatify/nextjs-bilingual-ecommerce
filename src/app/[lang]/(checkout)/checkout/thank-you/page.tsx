import type { Metadata } from "next";
import { ThankYou } from "@/components/checkout/thank-you";
import { asLocale } from "@/lib/i18n/store/config";
import { getDict } from "@/lib/i18n/store/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout/thank-you">): Promise<Metadata> {
  return {
    title: getDict(asLocale((await params).lang)).checkout.meta.thankYou,
    robots: { index: false, follow: false },
  };
}

export default function ThankYouPage() {
  return <ThankYou />;
}
