import type { Metadata } from "next";
import Link from "next/link";
import { latinFontVars } from "./fonts";
import "./store.css";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/**
 * Last-resort 404 for URLs that match no route at all (the proxy sends every storefront URL into
 * app/[lang], whose catch-all renders the localized 404 inside the store chrome — so this is rare).
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr" className={latinFontVars}>
      <body className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-ink">
        <main>
          <p className="text-poster">404</p>
          <h1 className="mt-4 text-h2">This page doesn&apos;t exist.</h1>
          <p className="mt-2 text-[16px] text-muted" lang="ar" dir="rtl">
            الصفحة دي مش موجودة.
          </p>
          <p className="mt-8 flex justify-center gap-3">
            <Link href="/" className="tap inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white">
              Home
            </Link>
            <Link href="/ar" lang="ar" className="tap inline-flex h-12 items-center rounded-full bg-surface px-6 text-[15px] font-semibold">
              الرئيسية
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
