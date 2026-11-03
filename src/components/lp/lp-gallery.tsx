"use client";

import { useEffect, useState } from "react";
import { Gallery } from "@/components/pdp/gallery";
import type { Product } from "@/lib/types";

export const LP_COLOR_EVENT = "lp:color";

/**
 * Server-rendered gallery (keeps the LCP image in the HTML) that follows the colour
 * picked in the order form, which lives in a separate Suspense boundary.
 */
export function LpGallery({ product }: { product: Product }) {
  const [colorIdx, setColorIdx] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setColorIdx((e as CustomEvent<number>).detail);
    window.addEventListener(LP_COLOR_EVENT, on);
    return () => window.removeEventListener(LP_COLOR_EVENT, on);
  }, []);
  return <Gallery product={product} colorIdx={colorIdx} />;
}
