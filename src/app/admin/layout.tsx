import "@/server/boot";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AdminI18nProvider } from "@/components/admin/i18n";
import { FxBoot } from "@/components/fx/fx-boot";
import { AdminThemeRoot, Toaster, type AdminTheme } from "@/components/admin/ui";
import { dirOf } from "@/lib/i18n/admin";
import { getAdminLocale, getT } from "@/lib/i18n/admin/server";
import { ensureArabicSeed } from "@/server/queries/ar-seed";
import { legacyKey } from "@/lib/legacy-name";
import "../globals.css";
import "./admin-i18n.css";
import { cairo, latinFontVars } from "../fonts";

// Arabic UI font (Cairo, shared with the storefront via app/fonts.ts): no preload, and its
// variable is only attached for the Arabic locale, so English sessions never download it.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t("shell.metaTitle"), template: `%s · ${t("shell.metaTitle")}` },
    robots: { index: false, follow: false },
  };
}

// keep in sync with ADMIN_THEME_COOKIE in components/admin/ui.tsx (constants can't cross the client boundary)
const COOKIE = "vedra_admin_theme";
const THEMES: AdminTheme[] = ["dark", "light", "system"];

async function readTheme(): Promise<AdminTheme> {
  const jar = await cookies();
  const v = (jar.get(COOKIE)?.value ?? jar.get(legacyKey(COOKIE))?.value) as AdminTheme | undefined;
  return v && THEMES.includes(v) ? v : "dark";
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await readTheme();
  if (theme === "system")
    return {
      themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
        { media: "(prefers-color-scheme: dark)", color: "#09090b" },
      ],
    };
  return { themeColor: theme === "light" ? "#f6f6f8" : "#09090b" };
}

export default async function AdminRoot({ children }: LayoutProps<"/admin">) {
  const locale = await getAdminLocale();
  // one-time, idempotent: fills Arabic copy for the seeded catalogue/content if it was never translated
  ensureArabicSeed();
  // app/admin is its own root layout (the storefront's root is app/[lang]/layout.tsx), so it owns <html>/<body>.
  return (
    // suppressHydrationWarning: FxBoot may add data-fx-seen to <html> before hydration
    <html lang={locale} dir={dirOf(locale)} className={locale === "ar" ? `${latinFontVars} ${cairo.variable}` : latinFontVars} suppressHydrationWarning>
      <body className="min-h-dvh">
        {/* pre-paint: marks <html data-fx-seen> on a reload of an already-opened page, so its enter doesn't replay */}
        <FxBoot />
        <AdminThemeRoot initial={await readTheme()} lang={locale} dir={dirOf(locale)} className="fixed inset-0 overflow-hidden">
          <AdminI18nProvider locale={locale}>
            {children}
            <Toaster />
          </AdminI18nProvider>
        </AdminThemeRoot>
      </body>
    </html>
  );
}
