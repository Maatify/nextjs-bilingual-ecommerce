"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * One set of delegated listeners powering the CSS-driven effects — no per-element JS:
 *  - `.fx-spot`          cursor-following spotlight (writes --mx/--my)
 *  - `[data-magnetic]`   element drifts a few px toward the cursor (writes --mgx/--mgy; pair with `.fx-magnetic`)
 *  - `.fx-press`         soft radial ripple from the pointer on press
 * Pointer work is batched to one rAF; nothing runs on touch for hover effects or under reduced motion.
 */
export function FxRuntime() {
  const pathname = usePathname();

  // Scroll reveal for every page section: sections below the fold start hidden (fade + small rise) and appear
  // as they enter the viewport; scrolling back up above them hides them again so they replay. Sections already
  // on screen when the page opens are never hidden (no flash, LCP untouched). Sections that contain fixed bars
  // (sticky add-to-bag) or opt out with data-no-reveal are skipped. Reduced motion → no reveal at all.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) el.setAttribute("data-fx-in", "");
          else if (e.boundingClientRect.top > 0) el.removeAttribute("data-fx-in"); // only when it's below the viewport again
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    const scan = () => {
      const main = document.querySelector("main");
      if (!main) return;
      const list = main.querySelectorAll<HTMLElement>("section, [data-reveal]");
      for (const el of list) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.parentElement?.closest("section, [data-reveal]") && !el.hasAttribute("data-reveal")) continue; // top-level only
        if (el.hasAttribute("data-no-reveal") || el.querySelector(".fixed, [data-no-reveal]")) continue;
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) continue; // already visible on open: leave it alone
        // data attributes, not classes: React compares className while it hydrates a streamed section, so an added
        // class showed up as a hydration mismatch on the product page (and a re-render would have wiped it)
        el.setAttribute("data-fx-rv", "");
        io.observe(el);
      }
    };
    scan();
    let t = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(scan, 80);
    });
    const main = document.querySelector("main");
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, [pathname]);

  // While the page is scrolling, hover effects are switched off (html[data-scrolling] → pointer-events: none on the
  // page content): otherwise every card that passes under a resting cursor fires its tilt, image swap and zoom,
  // which is what makes scrolling feel heavy. Restored 120ms after the last scroll event.
  // An image that failed (e.g. a network blip or a server restart) retries itself instead of leaving
  // the alt text in an empty box: up to 5 retries with backoff (1s, 2s, 4s, 8s, 16s).
  useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      const n = Number(img.dataset.retry || 0);
      if (n >= 5) return;
      img.dataset.retry = String(n + 1);
      const src = img.currentSrc || img.src;
      window.setTimeout(() => {
        if (!img.isConnected) return;
        const url = new URL(src, location.href);
        url.searchParams.set("r", String(n + 1));
        img.removeAttribute("srcset");
        img.src = url.toString();
      }, 1000 * 2 ** n);
    };
    document.addEventListener("error", onError, true);
    return () => document.removeEventListener("error", onError, true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let t = 0;
    const onScroll = () => {
      if (!root.hasAttribute("data-scrolling")) root.setAttribute("data-scrolling", "");
      window.clearTimeout(t);
      t = window.setTimeout(() => root.removeAttribute("data-scrolling"), 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
      root.removeAttribute("data-scrolling");
    };
  }, []);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last: PointerEvent | null = null;
    let mag: HTMLElement | null = null;

    const release = () => {
      if (!mag) return;
      mag.style.removeProperty("--mgx");
      mag.style.removeProperty("--mgy");
      mag = null;
    };

    const frame = () => {
      raf = 0;
      const e = last;
      if (!e || !(e.target instanceof Element)) return;
      // all reads (rects) before any write (custom properties): a read after a write forces a synchronous style recalc
      const spot = e.target.closest<HTMLElement>(".fx-spot");
      const m = reduce.matches ? null : e.target.closest<HTMLElement>("[data-magnetic]");
      const sr = spot?.getBoundingClientRect();
      const live = m && !(m as HTMLButtonElement).disabled ? m : null;
      const mr = live?.getBoundingClientRect();
      if (spot && sr) {
        spot.style.setProperty("--mx", `${(e.clientX - sr.left).toFixed(1)}px`);
        spot.style.setProperty("--my", `${(e.clientY - sr.top).toFixed(1)}px`);
      }
      if (m !== mag) release();
      if (live && mr) {
        mag = live;
        const k = Number(live.dataset.magnetic) || 0.22;
        const clamp = (v: number) => Math.max(-6, Math.min(6, v));
        live.style.setProperty("--mgx", `${clamp((e.clientX - (mr.left + mr.width / 2)) * k).toFixed(2)}px`);
        live.style.setProperty("--mgy", `${clamp((e.clientY - (mr.top + mr.height / 2)) * k - 1).toFixed(2)}px`);
      }
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !fine.matches) return;
      last = e;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const out = (e: PointerEvent) => {
      if (!e.relatedTarget) release();
    };
    const down = (e: PointerEvent) => {
      if (reduce.matches || !(e.target instanceof Element)) return;
      const host = e.target.closest<HTMLElement>(".fx-press");
      if (!host || (host as HTMLButtonElement).disabled) return;
      const r = host.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement("span");
      s.className = "fx-ripple";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--d", `${d}px`);
      s.style.setProperty("--rx", `${e.clientX - r.left - d / 2}px`);
      s.style.setProperty("--ry", `${e.clientY - r.top - d / 2}px`);
      host.appendChild(s);
      const done = () => s.remove();
      s.addEventListener("animationend", done, { once: true });
      setTimeout(done, 900);
    };

    // A view transition (card → PDP image morph) is aborted by the browser when the viewport resizes mid-way
    // (mobile keyboard closing on submit, rotation). The navigation itself still completes; don't surface it as an error.
    const vtAbort = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined;
      if (r && (r.name === "InvalidStateError" || r.name === "AbortError") && /transition/i.test(r.message ?? "")) e.preventDefault();
    };
    window.addEventListener("unhandledrejection", vtAbort);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("blur", release);
    return () => {
      cancelAnimationFrame(raf);
      release();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("blur", release);
      window.removeEventListener("unhandledrejection", vtAbort);
    };
  }, []);
  return null;
}
