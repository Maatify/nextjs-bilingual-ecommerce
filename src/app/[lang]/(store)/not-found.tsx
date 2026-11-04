import type { Metadata } from "next";
import { NotFoundView } from "@/components/collection/not-found-view";
import { DocTitle } from "@/components/i18n/doc-title";
import { getSite } from "@/lib/site";
import { getLocale } from "@/lib/i18n/store/server";
import { getDict } from "@/lib/i18n/store/dict";

/*
 * Localized "not found" <title> for every storefront 404 (unknown URL, product, collection or page).
 * Next 16 sends notFound() responses as a 404 whose server HTML is only the error shell (the UI below renders after
 * hydration — reproduced in a bare Next 16.4.3 app, so it's framework behaviour), but the head is still rendered on
 * the server: this keeps the server-side title right ("Page not found | VEDRA" / Arabic) instead of the home title.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDict(locale).collection.notFound.metaTitle, robots: { index: false } };
}

/** Localized 404 inside the store chrome (language comes from the [lang] root param inside NotFoundView). */
export default async function StoreNotFound() {
  const title = `${getDict(await getLocale()).collection.notFound.metaTitle} | ${getSite().name}`;
  return (
    <>
      <DocTitle title={title} />
      <NotFoundView />
    </>
  );
}
