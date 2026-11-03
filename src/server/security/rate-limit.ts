import { sdb } from "./db";

/**
 * Public-API abuse protection helpers (server only). Usage in a route handler:
 *
 *   import { clientIp, isBot, rateLimit, readJsonBody, tooMany } from "@/server/security/rate-limit";
 *
 *   export async function POST(req: Request) {
 *     const ip = clientIp(req);
 *     const rl = rateLimit(`contact:${ip}`, 5, 10 * 60_000);      // 5 requests / 10 min / IP
 *     if (!rl.ok) return tooMany(rl);                              // 429 + Retry-After
 *     const body = await readJsonBody<{ message?: unknown; website?: unknown }>(req, 8_192);
 *     if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
 *     if (isBot(body.data.website)) return NextResponse.json({ ok: true }); // pretend success, store nothing
 *     …validate every field (type, length, enum) before writing…
 *   }
 *
 * Honeypot: render a visually-hidden text input (e.g. name="website", tabIndex={-1}, autoComplete="off",
 * aria-hidden) that humans never fill; send its value in the JSON body; bots that fill it get a fake success.
 *
 * - rateLimit(key, limit, windowMs): fixed-window counter persisted in SQLite (sec_rate), so limits hold
 *   across restarts and across dev hot-reloads. Use a namespaced key ("orders:<ip>", "reviews:<ip>").
 * - isBot(honeypot): true when the honeypot field has any non-empty value.
 * - clientIp(req): the X-Forwarded-For hop added by your outermost trusted proxy (TRUST_PROXY_HOPS from the right,
 *   default 1), else X-Real-IP, else "local". Run Next behind a reverse proxy — exposed directly, XFF is client-controlled.
 * - readJsonBody(req, maxBytes): rejects bodies over maxBytes (413) and invalid JSON / non-objects (400).
 */

export interface RateResult {
  ok: boolean;
  remaining: number;
  /** ms until the window resets */
  retryAfter: number;
}

let lastPrune = 0;

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const db = sdb();
  const now = Date.now();
  if (now - lastPrune > 10 * 60_000) {
    lastPrune = now;
    db.prepare("DELETE FROM sec_rate WHERE reset_at < ?").run(now);
  }
  const k = key.slice(0, 200);
  const row = db.prepare("SELECT count, reset_at FROM sec_rate WHERE key = ?").get(k) as { count: number; reset_at: number } | undefined;
  if (!row || row.reset_at <= now) {
    db.prepare("INSERT INTO sec_rate (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at").run(k, now + windowMs);
    return { ok: true, remaining: limit - 1, retryAfter: windowMs };
  }
  if (row.count >= limit) return { ok: false, remaining: 0, retryAfter: row.reset_at - now };
  db.prepare("UPDATE sec_rate SET count = count + 1 WHERE key = ?").run(k);
  return { ok: true, remaining: limit - row.count - 1, retryAfter: row.reset_at - now };
}

export const isBot = (honeypot: unknown) => typeof honeypot === "string" ? honeypot.trim().length > 0 : honeypot != null && honeypot !== false;

/** How many reverse proxies you run in front of Next (each appends one X-Forwarded-For hop). Default 1. */
const PROXY_HOPS = Math.max(1, Math.min(5, Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "", 10) || 1));

/**
 * Client IP for rate limits / throttling. X-Forwarded-For is "client, proxy1, proxy2" and every proxy APPENDS,
 * so the left-most entries are whatever the client sent (spoofable — a fresh fake IP per request would bypass every
 * limit). We take the entry added by the outermost trusted proxy: the TRUST_PROXY_HOPS-th from the right.
 */
export function clientIp(req: Request | Headers) {
  const h = req instanceof Headers ? req : req.headers;
  const hops = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = hops[Math.max(0, hops.length - PROXY_HOPS)] || h.get("x-real-ip")?.trim() || "local";
  return ip.slice(0, 64);
}

export function tooMany(rl: RateResult, message = "Too many requests — please wait a moment and try again.") {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } });
}

/**
 * Browsers label every request with Sec-Fetch-Site; "cross-site" means another website's page is making this POST
 * (CSRF-style abuse: fake orders / spam fired from visitors' browsers). Our own pages send same-origin; non-browser
 * clients send nothing (they're covered by the rate limits). Browsers without Fetch Metadata (Safari < 16.4) still
 * send Origin on a cross-origin POST, so when Sec-Fetch-Site is absent a foreign Origin is refused too.
 */
export function isCrossSite(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "cross-site";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  try {
    return !!host && new URL(origin).host.toLowerCase() !== host;
  } catch {
    return true; // "null" (sandboxed iframe / data: URL) or garbage
  }
}

export async function readJsonBody<T extends object>(req: Request, maxBytes: number): Promise<{ ok: true; data: T } | { ok: false; status: 400 | 403 | 413 | 415; error: string }> {
  if (isCrossSite(req)) return { ok: false, status: 403, error: "Cross-site request blocked" };
  const type = req.headers.get("content-type") ?? "";
  if (type && !type.includes("application/json")) return { ok: false, status: 415, error: "Send JSON" };
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { ok: false, status: 413, error: "Request too large" };
  let text: string;
  try {
    // stream with a hard cap (content-length can be absent or wrong)
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return { ok: false, status: 413, error: "Request too large" };
        }
        chunks.push(value);
      }
    }
    text = Buffer.concat(chunks).toString("utf8");
  } catch {
    return { ok: false, status: 400, error: "Invalid request" };
  }
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, status: 400, error: "Invalid request" };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid request" };
  }
}
