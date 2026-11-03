"use client";

import { useEffect } from "react";

/**
 * Re-asserts document.title after hydration. Used by the storefront 404: with `experimental.globalNotFound` Next resolves
 * the client-side head of a notFound() response from the page (→ the home title) even though the server HTML carries the
 * not-found title, so JS-rendering crawlers and the browser tab would otherwise show the home page title.
 */
export function DocTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
