import type { Metadata } from "next";
import { WishlistView } from "@/components/collection/wishlist-view";
import { asLocale } from "@/lib/i18n/store/config";
import { getDict } from "@/lib/i18n/store/dict";

export async function generateMetadata({ params }: PageProps<"/[lang]/wishlist">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: getDict(asLocale(lang)).collection.wishlist.metaTitle,
    robots: { index: false, follow: true },
  };
}

export default async function WishlistPage({ params }: PageProps<"/[lang]/wishlist">) {
  const { lang } = await params;
  const T = getDict(asLocale(lang)).collection.wishlist;
  return (
    <div className="container-x pt-6 md:pt-12">
      <h1 className="mb-6 text-poster md:mb-10">{T.heading}</h1>
      <WishlistView />
    </div>
  );
}
