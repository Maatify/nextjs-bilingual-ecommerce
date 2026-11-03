import { PageTransition } from "@/components/fx/page-transition";

/**
 * Page-open animation (short rise + fade, CSS, transform/opacity only) — plays the first time each path is
 * opened in the browser session, never on revisits, re-renders or search-param changes. Leaving a page
 * dissolves it through a view transition (see fx/page-transition.tsx).
 */
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition variant="store">{children}</PageTransition>;
}
