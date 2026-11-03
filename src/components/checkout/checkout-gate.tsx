"use client";

import { useI18n } from "@/components/i18n/provider";
import { useStore } from "@/lib/store";
import { CheckoutForm } from "./checkout-form";

/** Waits for the persisted cart to hydrate before mounting the form (avoids an empty-bag flash). */
export function CheckoutGate() {
  const hydrated = useStore((s) => s.hydrated);
  const { d } = useI18n();
  if (!hydrated) {
    return (
      <div className="container-x pb-16 pt-4 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6" aria-busy="true" aria-label={d.checkout.loading}>
        <div className="space-y-4">
          <div className="h-14 animate-pulse rounded-[24px] bg-surface lg:hidden" />
          <div className="h-72 animate-pulse rounded-[24px] bg-surface" />
          <div className="h-96 animate-pulse rounded-[24px] bg-surface" />
        </div>
        <div className="hidden h-[480px] animate-pulse rounded-[24px] bg-surface lg:block" />
      </div>
    );
  }
  return <CheckoutForm />;
}
