import "@/server/boot";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { I18nProvider } from "@/components/i18n/provider";
import { FxBoot } from "@/components/fx/fx-boot";
import { Curtain } from "@/components/brand/curtain";
import { getContent } from "@/lib/data";
import { localizeContent } from "@/lib/i18n/store/content";
import { JsonLd } from "@/components/json-ld";
import { StoreDataProvider } from "@/components/store-data-provider";
import { publicSnapshot } from "@/lib/data";
import { dirOf, isLocale, LOCALES, ogLocale } from "@/lib/i18n/store/config";
import { getDict } from "@/lib/i18n/store/dict";
import { organizationLd, siteDescription, websiteLd } from "@/lib/seo";
import { getSite } from "@/lib/site";
import { arabicFontHref } from "@/server/font-preload";
import { arabicFontVars, latinFontVars } from "../fonts";
import "../store.css";

/**
 * Both languages are prerendered; any other first segment is a 404 via notFound() below.
 * Not `dynamicParams = false`: with the proxy's /x → /en/x rewrite, ISR regeneration after
 * revalidatePath("/", "layout") (every order / admin write) checked the un-rewritten path against the
 * static list, threw NoFallbackError and cached the 404 page for every storefront URL.
 */
export const dynamicParams = true;
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "en";
  const site = getSite();
  const d = getDict(locale);
  return {
    metadataBase: new URL(site.url),
    // Arabic titles use "|" like every other Arabic title (no em-dash in Arabic copy)
    title: { default: `${site.name}${locale === "ar" ? " | " : " — "}${d.pages.meta.homeTitle}`, template: `%s | ${site.name}` },
    description: siteDescription(locale),
    applicationName: site.name,
    openGraph: { type: "website", siteName: site.name, locale: ogLocale(locale), alternateLocale: [ogLocale(locale === "ar" ? "en" : "ar")], url: locale === "ar" ? "/ar" : "/" },
    twitter: { card: "summary_large_image" },
    // indexable is the default; pages that must not be indexed set robots themselves (and 404s get Next's noindex)
    robots: { googleBot: { "max-image-preview": "large", "max-snippet": -1 } },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#ecede8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDict(lang);
  // Arabic pages only: preload Cairo's Arabic subset so it's ready before first paint (no swap re-wrap / CLS)
  const arFont = lang === "ar" ? arabicFontHref() : null;
  if (arFont) preload(arFont, { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <html lang={lang} dir={dirOf(lang)} className={lang === "ar" ? `${latinFontVars} ${arabicFontVars}` : latinFontVars} data-store="" suppressHydrationWarning>
      <body className="min-h-dvh">
        {/* pre-paint: don't replay the page-open animation on a reload of a page already opened this session */}
        <FxBoot />
        {/* opening curtain on every full page load (refresh / first visit); client navigations keep this layout mounted */}
        <Curtain name={getSite().name} locale={lang} tapeA={localizeContent(getContent(), lang).ribbons.a} tapeB={localizeContent(getContent(), lang).ribbons.b} />
        <a href="#main" className="sr-only z-[100] rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4">
          {dict.common.skipToContent}
        </a>
        <I18nProvider locale={lang} dict={dict}>
          <StoreDataProvider snapshot={publicSnapshot()}>{children}</StoreDataProvider>
        </I18nProvider>
        <JsonLd data={[organizationLd(lang), websiteLd(lang)]} />
      </body>
    </html>
  );
}
