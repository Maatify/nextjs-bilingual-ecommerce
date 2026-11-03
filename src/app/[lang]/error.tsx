"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonLink } from "@/components/ui/primitives";

const COPY = {
  en: { title: "Something went wrong", body: "This page didn't load properly. Try again, or head back to the shop.", retry: "Try again", home: "Back to the shop" },
  ar: { title: "حصلت مشكلة", body: "الصفحة دي مفتحتش زي ما كان المفروض. جرّب تاني، أو ارجع للمحل.", retry: "جرّب تاني", home: "ارجع للمحل" },
} as const;

/** Storefront error boundary (every [lang] route): bilingual, retry + home, never shows error details to shoppers. */
export default function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  const { locale } = useI18n();
  const T = COPY[locale === "ar" ? "ar" : "en"];
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="container-x grid min-h-[70dvh] place-items-center py-16">
      <div className="flex w-full max-w-[560px] flex-col items-center rounded-[24px] bg-surface px-5 py-12 text-center md:p-16">
        <span className="grid size-14 place-items-center rounded-full bg-surface-2" aria-hidden>
          <Icon name="info" size={24} />
        </span>
        <h1 className="mt-5 text-h2">{T.title}</h1>
        <p className="mt-2 text-[15px] text-muted">{T.body}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>{T.retry}</Button>
          <ButtonLink href="/" variant="outline">
            {T.home} <Icon name="arrowUpRight" size={16} />
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
