"use client";

import { useSyncExternalStore } from "react";

function mq(query: string) {
  return {
    subscribe(cb: () => void) {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    get: () => window.matchMedia(query).matches,
  };
}

const FX = mq("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

/** True only for a mouse/trackpad user who hasn't asked for reduced motion (false on the server and on touch). */
export function useFx() {
  return useSyncExternalStore(FX.subscribe, FX.get, () => false);
}

function readRtl() {
  const scoped = document.querySelector(".admin[dir], [data-fx-dir]")?.getAttribute("dir");
  return (scoped || document.documentElement.dir || document.dir) === "rtl";
}
function subscribeDir(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["dir"] });
  return () => o.disconnect();
}
/** Reading direction for direction-aware motion (drawer slide side, etc.). */
export function useIsRtl() {
  return useSyncExternalStore(subscribeDir, readRtl, () => false);
}
