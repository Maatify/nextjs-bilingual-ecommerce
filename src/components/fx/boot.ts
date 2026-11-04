/* Shared by the client PageTransition and the server root layout (plain module — no "use client"). */

export const FX_SEEN_KEY = "vedra:fx-seen";

export const pathKey = (p: string) => p.replace(/^\/(?:ar|en)(?=\/|$)/, "").replace(/\/+$/, "") || "/";

/** Inline, pre-paint: flag a reload/re-entry of an already-seen path so the SSR page-enter doesn't replay. */
export const FX_BOOT_SCRIPT = `try{var k=${JSON.stringify(FX_SEEN_KEY)},p=location.pathname.replace(/^\\/(?:ar|en)(?=\\/|$)/,"").replace(/\\/+$/,"")||"/",s=JSON.parse(sessionStorage.getItem(k)||"[]");if(s.indexOf(p)>-1)document.documentElement.setAttribute("data-fx-seen","")}catch(e){}`;

