/*
 * Cookie names shared by src/server/auth.ts and src/proxy.ts (no Node imports — the proxy only checks presence).
 * Secure deployments use the `__Host-` prefix: the browser then only accepts the cookie when it is Secure,
 * Path=/ and has no Domain — so a subdomain or a plain-http MITM can't plant or overwrite it.
 */
export const SESSION_COOKIE = "vedra_admin";
export const SESSION_COOKIE_SECURE = "__Host-vedra_admin";
export const CHALLENGE_COOKIE = "vedra_2fa";
export const CHALLENGE_COOKIE_SECURE = "__Host-vedra_2fa";

/** Hosts where a plain-http production build may be tested: loopback and private-LAN IP literals only. */
const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?$/i;
let warned = false;

/**
 * Secure (`__Host-`, Secure) cookies in production. ADMIN_INSECURE_COOKIE=1 relaxes this ONLY for a request that
 * is plain http to a loopback / private-LAN host (testing a production build locally). On a real deployment
 * (https, or any public hostname) the flag is ignored — with a one-time warning — so a leftover env var can't
 * downgrade the admin cookie.
 */
export function secureCookies(h?: Headers): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (!process.env.ADMIN_INSECURE_COOKIE) return true;
  if (!h) return true;
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (proto !== "https" && LOCAL_HOST.test(host)) return false;
  if (!warned) {
    warned = true;
    console.warn(`[vedra] ADMIN_INSECURE_COOKIE is set but this request is ${proto || "?"}://${host || "?"} — ignoring it (secure cookies stay on). Remove it from the production environment.`);
  }
  return true;
}
