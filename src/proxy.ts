import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, stripLocale } from "./lib/i18n/store/config";
import { SESSION_COOKIE, SESSION_COOKIE_SECURE } from "./server/security/cookie-names";

/** Same cookie the language switcher writes (one year, whole site). */
const LANG_COOKIE_OPTS = { path: "/", maxAge: 31536000, sameSite: "lax" } as const;

/*
 * Next 16 "proxy" (formerly middleware). Two independent jobs, split by path:
 *
 * 1) Admin edge guard — /admin/** and /api/admin/** only.
 *    A cheap, optimistic check: no session cookie → redirect to /admin/login (pages) or 401 (API).
 *    The cookie is NOT validated here; real validation (DB session, expiry, idle timeout) always happens
 *    server-side in requireAdmin()/isAdmin() inside every admin page, server action and route handler.
 *    Every admin response gets `Cache-Control: no-store` (nothing admin-side may land in a shared/browser
 *    cache) and `X-Robots-Tag: noindex, nofollow`.
 *
 * 2) Storefront language routing — every other page URL (never /api, /_next, /media or files).
 *    English keeps the unprefixed URLs and is served from app/[lang] via an internal rewrite to /en/…;
 *    Arabic lives at /ar/…. A shopper's first visit (no `verda_lang` cookie) whose Accept-Language prefers
 *    Arabic is redirected to the /ar equivalent; after that the cookie (set by the language switcher) wins.
 *    Rewrites hit the prerendered pages, so the storefront stays fully static.
 */

function harden(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function adminGuard(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasCookie = req.cookies.has(SESSION_COOKIE_SECURE) || req.cookies.has(SESSION_COOKIE);
  const isLogin = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  if (!hasCookie && !isLogin) {
    if (pathname.startsWith("/api/")) return harden(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return harden(NextResponse.redirect(url));
  }
  return harden(NextResponse.next());
}

const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/") || p === "/api/admin";

// optional "/<id>" suffix: product share images use generateImageMetadata (…/opengraph-image-<hash>/card)
const SHARE_IMAGE = /\/(?:opengraph|twitter)-image(?:-[\w-]+)?(?:\/[\w-]+)?$/;
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegram|twitter|linkedin|pinterest|embedly|preview|inspectiontool/i;

/** True when the highest-weighted Accept-Language entry is Arabic (ar, ar-EG, …). */
function prefersArabic(header: string | null) {
  if (!header) return false;
  let best = { tag: "", q: -1 };
  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().toLowerCase().split(";");
    if (!tag || tag === "*") continue;
    const qp = params.find((x) => x.trim().startsWith("q="));
    const q = qp ? Number(qp.trim().slice(2)) : 1;
    if (Number.isFinite(q) && q > best.q) best = { tag, q };
  }
  return best.tag === "ar" || best.tag.startsWith("ar-");
}

function storefront(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Generated share images of English pages are addressed by their internal /en/… route (Next builds the
  // og:image URL from the matched route) — serve them directly instead of bouncing scrapers through a 308.
  if (pathname.startsWith("/en/") && SHARE_IMAGE.test(pathname)) return NextResponse.next();

  // /en/… is the shareable "open in English" link: it remembers English (the language switcher's cookie) so an
  // Arabic-first phone isn't sent on to /ar, then lands on the canonical unprefixed English URL. 307, not 308: a
  // browser-cached permanent redirect would skip the proxy and never set the cookie again.
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = stripLocale(pathname).path;
    const res = NextResponse.redirect(url, 307);
    res.cookies.set(LANG_COOKIE, "en", LANG_COOKIE_OPTS);
    return res;
  }

  // Arabic: served as-is by app/[lang] with lang = "ar". Opening an /ar link counts as choosing Arabic, so later
  // unprefixed links stay Arabic even on an English phone.
  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    const res = NextResponse.next();
    if (req.cookies.get(LANG_COOKIE)?.value !== "ar") res.cookies.set(LANG_COOKIE, "ar", LANG_COOKIE_OPTS);
    return res;
  }

  // English URL. A remembered Arabic choice — or, on a first visit, an Arabic-first browser — goes to /ar.
  const saved = req.cookies.get(LANG_COOKIE)?.value;
  const isPrefetch = req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch";
  // Crawlers / link-preview bots always get the URL they asked for: auto-redirecting them by Accept-Language
  // would hide the English pages from search engines (each language is reachable via its own URL + hreflang).
  const isBot = BOT_UA.test(req.headers.get("user-agent") ?? "");
  if (!isPrefetch && !isBot && (saved === "ar" || (!saved && prefersArabic(req.headers.get("accept-language"))))) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/ar" : `/ar${pathname}`;
    const res = NextResponse.redirect(url, 307);
    res.headers.set("Vary", "Accept-Language, Cookie");
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
  return NextResponse.rewrite(url);
}

export function proxy(req: NextRequest) {
  return isAdminPath(req.nextUrl.pathname) ? adminGuard(req) : storefront(req);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    // storefront pages: everything except API routes, Next internals, media and files with an extension
    "/((?!api/|_next/|_vercel|__nextjs|media/|.*\\..*).*)",
  ],
};
