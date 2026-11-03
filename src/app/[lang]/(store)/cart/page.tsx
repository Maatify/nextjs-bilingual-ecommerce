import type { Metadata } from "next";
import { Suspense } from "react";
import { CartView } from "@/components/checkout/cart-view";
import { asLocale, localeHref } from "@/lib/i18n/store/config";
import { getDict, getI18n } from "@/lib/i18n/store/server";
import { CartRestore } from "./restore";

export async function generateMetadata({ params }: PageProps<"/[lang]/cart">): Promise<Metadata> {
  const locale = asLocale((await params).lang);
  return {
    title: getDict(locale).cart.metaTitle,
    robots: { index: false, follow: true },
    alternates: { canonical: localeHref(locale, "/cart") },
  };
}

export default async function CartPage() {
  const { d } = await getI18n();
  return (
    <div className="container-x pb-36 pt-6 md:pb-16 md:pt-10">
      <h1 className="text-poster mb-6 md:mb-8">{d.cart.title}</h1>
      <CartView />
      <Suspense fallback={null}>
        <CartRestore />
      </Suspense>
    </div>
  );
}
