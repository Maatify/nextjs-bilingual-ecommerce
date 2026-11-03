import type { Metadata } from "next";
import { CheckoutGate } from "@/components/checkout/checkout-gate";
import { asLocale } from "@/lib/i18n/store/config";
import { getDict } from "@/lib/i18n/store/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout">): Promise<Metadata> {
  return {
    title: getDict(asLocale((await params).lang)).checkout.meta.checkout,
    robots: { index: false, follow: false },
  };
}

export default function CheckoutPage() {
  return <CheckoutGate />;
}
