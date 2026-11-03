"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { FX_SEEN_KEY, pathKey } from "./boot";

/*
 * Page transitions on EVERY navigation (transform/opacity only):
 *  - first open of a path this session → a richer staggered reveal of the page's sections (`fx-page-enter`);
 *  - revisits → a lighter rise + fade (`fx-page-nav`), so moving between pages always feels animated;
 *  - load-in effects inside pages (counters, charts, blooms) still run only on the first open (useFirstOpen).
 *
 * - Visited paths live in sessionStorage (locale prefix stripped, so switching language doesn't replay).
 * - Client navigations: the template remounts, and the wrapper animates only if the path is new.
 * - The very first, server-rendered page: the class is always in the HTML (so the animation starts at
 *   first paint, before hydration) and FX_BOOT_SCRIPT — an inline script that runs before the body
 *   paints — marks <html data-fx-seen> when that path was already opened this session (reload, back
 *   from another site), which turns the animation off in CSS. On first load the keyframes are
 *   transform/filter only (`fx-page-enter-ssr`) so the LCP image is never hidden behind opacity.
 * - Search-param changes and re-renders never remount the template, so they never replay it.
 * - No View Transition on navigation: it kept the old page on screen ~0.4s per click (felt laggy). The new page
 *   commits at once and plays a short enter. (Old notes:) Leaving a storefront page: where the View Transitions API exists,
 *   the outgoing page is snapshotted and dissolves (`fx-exit`, ~140ms, opacity/transform only) over the
 *   incoming one, which is already in place underneath. The root, header and morphing product image keep
 *   their own rules (globals.css). No API → instant swap; reduced motion → no animation.
 * - Everything here is transform/opacity only: no filter/blur/perspective on page-sized layers.
 */

function readSeen(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(FX_SEEN_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function markSeen(key: string) {
  try {
    const s = readSeen();
    if (!s.includes(key)) sessionStorage.setItem(FX_SEEN_KEY, JSON.stringify([...s, key].slice(-200)));
  } catch {}
}

/** Set after the first (hydrating) PageTransition mounts; later mounts are client navigations. */
let hydrated = false;

/** ssr = first server-rendered page · enter = first open via client nav (rich, staggered) · nav = revisit (lighter, every time) */
type Mode = "ssr" | "enter" | "nav";
const FirstOpen = createContext(true);

/** True while the current page is being opened for the first time this session (gate load-in effects on it). */
export function useFirstOpen() {
  return useContext(FirstOpen);
}

/**
 * Wrap a route's content (Next.js template). Keyed by path internally, so sibling dynamic routes
 * (/collections/a → /collections/b) that share a template instance still get their own first-open.
 */
export function PageTransition({ children, className, variant = "store" }: { children: React.ReactNode; className?: string; variant?: "store" | "admin" }) {
  const path = pathKey(usePathname() || "/");
  return (
    <Enter key={path} path={path} className={className} variant={variant}>
      {children}
    </Enter>
  );
}

function Enter({ children, className, variant, path }: { children: React.ReactNode; className?: string; variant: "store" | "admin"; path: string }) {
  const [mode] = useState<Mode>(() => {
    if (typeof window === "undefined" || !hydrated) return "ssr"; // must match the server HTML
    return readSeen().includes(path) ? "nav" : "enter";
  });
  useEffect(() => {
    hydrated = true;
    markSeen(path);
  }, [path]);
  const enter = variant === "admin" ? "a-page-enter" : "fx-page-enter";
  return (
    <FirstOpen.Provider value={mode !== "nav"}>
        <div
          data-fx-ssr={mode === "ssr" ? "" : undefined}
          className={cx(
            mode === "enter" && enter,
            mode === "nav" && (variant === "admin" ? "a-page-nav" : "fx-page-nav"),
            mode === "ssr" && (variant === "admin" ? enter : "fx-page-enter-ssr"),
            className,
          )}
        >
          {children}
        </div>
    </FirstOpen.Provider>
  );
}
