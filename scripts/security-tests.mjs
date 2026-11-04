#!/usr/bin/env node
/*
 * Active security tests (DAST-style, against YOUR OWN running build).
 *
 *   BASE_URL=http://localhost:3456 node scripts/security-tests.mjs           # full run (creates + deletes test rows)
 *   BASE_URL=http://localhost:3456 node scripts/security-tests.mjs --safe    # nothing stored: skips tests that create rows
 *
 * Never point this at a host you don't own. Row-creating tests only run when BASE_URL is localhost (the script
 * needs direct access to data/vedra.db to delete exactly what it created). Every rate-limit / throttle key the
 * script touches is isolated with a per-run X-Forwarded-For test IP (198.18.<run>.<n>, RFC 2544 benchmark range)
 * and removed at the end; the global sign-in counter is restored to its pre-run value.
 *
 * Playwright (browser checks: XSS dialogs, CSP violations, login capture) is loaded from `playwright-core` or
 * PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs; browser checks are skipped when it's missing (a failure when CI is set).
 * Exit code 1 when any check fails.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.BASE_URL || "http://localhost:3456").replace(/\/$/, "");
const SAFE = process.argv.includes("--safe");
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
const DB_PATH = process.env.VEDRA_DB ?? path.join(ROOT, "data", "vedra.db");
const WRITES = LOCAL && !SAFE && fs.existsSync(DB_PATH);
const RUN = Math.floor(Math.random() * 250) + 1;
const NONCE = `st${Date.now().toString(36)}`;
const XSS = ["<script>alert(1)</script>", `"><img src=x onerror=alert(1)>`];

let ipN = 0;
const usedIps = new Set();
/** fresh test IP → its own rate-limit / throttle keys */
const ip = () => {
  const v = `198.18.${RUN}.${++ipN}`;
  usedIps.add(v);
  return v;
};

const results = [];
const created = { messages: [], orders: [], reviews: [], subscribers: [], activity: [], restoredProducts: [] };
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const skip = (name, why) => {
  results.push({ name, ok: true, skipped: true, detail: why });
  console.log(`SKIP  ${name}  — ${why}`);
};

async function req(p, { method = "GET", headers = {}, body, json, xff = ip(), redirect = "manual" } = {}) {
  const h = { "x-forwarded-for": xff, ...headers };
  if (json !== undefined) {
    h["content-type"] ??= "application/json";
    body = typeof json === "string" ? json : JSON.stringify(json);
  }
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + p, { method, headers: h, body, redirect });
      const text = await r.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {}
      return { status: r.status, headers: r.headers, text, data };
    } catch (e) {
      if (i >= 5) throw e; // server restarting (another agent rebuilding) → retry
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}
const LEAK = /(\n\s+at [\w.<>]+ \(|node_modules|\/Users\/|webpack-internal|SqliteError|SQLITE_|TypeError:|ReferenceError:)/;
const noLeak = (r) => !LEAK.test(r.text);

/* ───────────────────────── DB helpers (local only) ───────────────────────── */
let db = null;
const snap = {};
function dbOpen() {
  if (!fs.existsSync(DB_PATH)) return null;
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}
/** the server creates the sec_* tables lazily (first sign-in / rate-limited request), so a fresh DB may not have them yet */
const hasTable = (name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
function snapshotBefore() {
  snap.activityMax = db.prepare("SELECT COALESCE(MAX(id),0) m FROM activity").get().m;
  snap.global = hasTable("sec_throttle") ? (db.prepare("SELECT * FROM sec_throttle WHERE key = 'global'").get() ?? null) : null;
  snap.products = new Map(db.prepare("SELECT id, data FROM products").all().map((r) => [r.id, r.data]));
  snap.orderNumbers = db.prepare("SELECT number FROM orders").all().map((r) => r.number);
  snap.subscribers = db.prepare("SELECT contact FROM subscribers").all().map((r) => r.contact);
}
const sentinels = () => [...snap.orderNumbers, ...snap.subscribers].filter((s) => s && s.length >= 6);

/** Undo exactly what this run created. */
function cleanup() {
  if (!db) return;
  const del = (sql, ...a) => Number(db.prepare(sql).run(...a).changes);
  // stored test rows — matched by this run's nonce / returned ids only
  for (const r of db.prepare("SELECT id FROM messages WHERE data LIKE ?").all(`%${NONCE}%`)) created.messages.push(r.id);
  created.messages = [...new Set(created.messages)];
  for (const id of created.messages) del("DELETE FROM messages WHERE id = ?", id);
  for (const r of db.prepare("SELECT id FROM reviews WHERE data LIKE ? AND status = 'pending'").all(`%${NONCE}%`)) created.reviews.push(r.id);
  created.reviews = [...new Set(created.reviews)];
  for (const id of created.reviews) del("DELETE FROM reviews WHERE id = ? AND status = 'pending'", id);
  for (const r of db.prepare("SELECT id, contact FROM subscribers WHERE contact LIKE ?").all(`%${NONCE}%`)) {
    created.subscribers.push(`${r.id}:${r.contact}`);
    del("DELETE FROM subscribers WHERE id = ?", r.id);
  }
  // orders + the stock they decremented
  const touched = new Map();
  for (const num of created.orders) {
    const row = db.prepare("SELECT data FROM orders WHERE number = ?").get(num);
    if (!row) continue;
    for (const l of JSON.parse(row.data).lines) {
      const k = `${l.productId}|${l.color}|${l.size}`;
      touched.set(k, (touched.get(k) ?? 0) + l.qty);
    }
    del("DELETE FROM orders WHERE number = ?", num);
    if (hasTable("sec_idempotency")) del("DELETE FROM sec_idempotency WHERE order_number = ?", num);
  }
  const byProduct = new Map();
  for (const [k, qty] of touched) {
    const [id, color, size] = k.split("|");
    byProduct.set(id, [...(byProduct.get(id) ?? []), { color, size, qty }]);
  }
  for (const [id, lines] of byProduct) {
    const cur = db.prepare("SELECT data FROM products WHERE id = ?").get(id);
    if (!cur) continue;
    const p = JSON.parse(cur.data);
    for (const l of lines) {
      const v = (p.variants ?? []).find((x) => x.color === l.color && x.size === l.size);
      if (v) v.stock += l.qty;
      const s = (p.sizes ?? []).find((x) => x.label === l.size);
      if (s && typeof s.stock === "number") s.stock += l.qty;
    }
    const before = snap.products.get(id);
    const strip = (d) => JSON.stringify({ ...(typeof d === "string" ? JSON.parse(d) : d), updatedAt: 0 });
    // identical to the pre-run row apart from updatedAt → put the exact original back; else keep the corrected row
    const data = before && strip(before) === strip(p) ? before : JSON.stringify(p);
    db.prepare("UPDATE products SET data = ? WHERE id = ?").run(data, id);
    created.restoredProducts.push(`${id}(${lines.map((l) => `${l.color}/${l.size}+${l.qty}`).join(",")})${data === before ? " exact" : " delta"}`);
  }
  // activity rows written by this run
  const ipLike = `%198.18.${RUN}.%`;
  const acts = db
    .prepare("SELECT id, action, target FROM activity WHERE id > ? AND (target LIKE ? OR detail LIKE ? OR detail LIKE ? OR target IN (SELECT value FROM json_each(?)))")
    .all(snap.activityMax, `%${NONCE}%`, `%${NONCE}%`, ipLike, JSON.stringify(created.orders));
  for (const a of acts) {
    created.activity.push(`${a.id}:${a.action}`);
    del("DELETE FROM activity WHERE id = ?", a.id);
  }
  // rate-limit + throttle keys of this run's test IPs; global sign-in counter back to its pre-run value
  let rate = 0;
  const rateT = hasTable("sec_rate");
  const throttleT = hasTable("sec_throttle");
  for (const v of usedIps) {
    if (rateT) rate += del("DELETE FROM sec_rate WHERE key LIKE ?", `%:${v}`);
    if (throttleT) rate += del("DELETE FROM sec_throttle WHERE key = ?", `ip:${v}`);
  }
  if (snap.global) db.prepare("UPDATE sec_throttle SET fails = ?, first_at = ?, last_at = ?, locked_until = ? WHERE key = 'global'").run(snap.global.fails, snap.global.first_at, snap.global.last_at, snap.global.locked_until);
  else if (throttleT) del("DELETE FROM sec_throttle WHERE key = 'global'");
  console.log(`\nCLEANUP  messages=${JSON.stringify(created.messages)} reviews=${JSON.stringify(created.reviews)} subscribers=${JSON.stringify(created.subscribers)} orders=${JSON.stringify(created.orders)}`);
  console.log(`         stock restored=${JSON.stringify(created.restoredProducts)} activity ids=${JSON.stringify(created.activity)} rate/throttle rows=${rate} global throttle restored`);
}

/* ───────────────────────── Playwright ───────────────────────── */
let browser = null;
async function getBrowser() {
  if (browser !== null) return browser || null;
  // playwright-core is a devDependency; PLAYWRIGHT_CORE can point at another install. The browser is Playwright's own
  // Chromium (`npx playwright install chromium`) unless PW_CHANNEL picks an installed channel such as "chrome".
  const candidates = [process.env.PLAYWRIGHT_CORE, "playwright-core"].filter(Boolean);
  let lastError = "";
  for (const c of candidates) {
    try {
      const { chromium } = await import(c);
      browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, headless: true });
      return browser;
    } catch (e) {
      lastError = String(e?.message ?? e).split("\n")[0];
    }
  }
  browser = false;
  // in CI a missing browser must not silently turn the browser-based checks into skips
  if (process.env.CI) check("browser available for browser-based checks", false, lastError);
  return null;
}
/** open a page that records dialogs + CSP violations + page errors */
async function openPage(url, { xff = ip(), wait = 1500, before } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({ extraHTTPHeaders: { "x-forwarded-for": xff }, locale: "en-US" });
  const page = await ctx.newPage();
  const log = { dialogs: [], csp: [], errors: [] };
  page.on("dialog", (d) => {
    log.dialogs.push(d.message());
    d.dismiss().catch(() => {});
  });
  page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && log.csp.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => log.errors.push(String(e).slice(0, 200)));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.log(`Refused to load (CSP ${e.violatedDirective}) ${e.blockedURI}`)));
  if (before) await before(page, ctx);
  for (let i = 0; ; i++) {
    try {
      await page.goto(BASE + url, { waitUntil: "load" });
      break;
    } catch (e) {
      if (i >= 10 || !/ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE/.test(String(e))) throw e; // server restarting
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
  await page.waitForTimeout(wait);
  return { page, ctx, log };
}

/* ───────────────────────── tests ───────────────────────── */

async function headersTest() {
  const urls = ["/", "/ar", "/products/heavyweight-hoodie", "/admin/login", "/api/recent-purchases", "/api/orders/track?number=VD-1&phone=01000000000"];
  for (const u of urls) {
    const r = await req(u);
    const h = r.headers;
    const csp = h.get("content-security-policy") ?? "";
    const miss = [];
    if (!/default-src 'self'/.test(csp)) miss.push("CSP default-src");
    if (!/frame-ancestors 'none'/.test(csp) && h.get("x-frame-options") !== "DENY") miss.push("frame-ancestors/XFO");
    if (!/object-src 'none'/.test(csp)) miss.push("object-src");
    if (h.get("x-content-type-options") !== "nosniff") miss.push("nosniff");
    if (!h.get("referrer-policy")) miss.push("Referrer-Policy");
    if (!h.get("permissions-policy")) miss.push("Permissions-Policy");
    if (BASE.startsWith("https:") || LOCAL) if (!h.get("strict-transport-security")) miss.push("HSTS");
    if (h.get("x-powered-by")) miss.push("X-Powered-By present");
    if (u.startsWith("/admin") && !/no-store/.test(h.get("cache-control") ?? "")) miss.push("admin no-store");
    check(`headers ${u}`, !miss.length, miss.join(", ") || `${r.status}`);
  }
}

async function bundleGrep() {
  const dir = path.join(ROOT, ".next", "static");
  if (!fs.existsSync(dir)) return skip("client bundle secret grep", "no .next/static (run next build)");
  const pats = [/sk_(live|test)_[0-9a-zA-Z]{8,}/, /-----BEGIN [A-Z ]*PRIVATE KEY/, /AKIA[0-9A-Z]{16}/, /vedra\.db|data\/vedra/, /process\.env\.[A-Z_]*(SECRET|PASSWORD|KEY|TOKEN)/, /ADMIN_PASSWORD\s*[:=]\s*["'][^"']+/, /\b[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9-]+\.(com|net|org|eg|io)\b/];
  // private / disabled promo codes must never ship to the client
  if (db) {
    try {
      const s = JSON.parse(db.prepare("SELECT value FROM kv WHERE key = 'settings'").get().value);
      for (const c of s.promoCodes ?? []) if (c.private || !c.active) pats.push(new RegExp(`["']${c.code.replace(/[^\w-]/g, "")}["']`));
    } catch {}
  }
  const hits = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(js|css|json|html|txt)$/.test(f.name)) {
        const t = fs.readFileSync(p, "utf8");
        for (const re of pats) if (re.test(t)) hits.push(`${path.relative(dir, p)}: ${re}`);
      }
    }
  };
  walk(dir);
  check("client bundle secret grep (.next/static)", !hits.length, hits.slice(0, 5).join("; ") || "no secrets / db paths / emails / private promo codes");
  // the server-rendered snapshot must not carry cost prices or unpublished / private data
  const home = await req("/");
  const leaks = ["\\\"cost\\\"", "\"cost\":", "unitCost", "\"private\":true", "\\\"private\\\":true", "passwordHash", "ADMIN_PASSWORD="].filter((s) => home.text.includes(s));
  check("home HTML snapshot has no cost / private promo / secrets", !leaks.length, leaks.join(", "));
}

async function cspBrowser() {
  if (!(await getBrowser())) return skip("CSP violations in browser", "playwright-core not available");
  for (const u of ["/", "/products/heavyweight-hoodie", "/ar"]) {
    const { ctx, log } = await openPage(u, { wait: 2500 });
    check(`no CSP violations on ${u}`, !log.csp.length, log.csp.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

async function reflectedXss() {
  const hasBrowser = await getBrowser();
  for (const x of XSS) {
    const q = encodeURIComponent(x);
    const r = await req(`/search?q=${q}`);
    const raw = r.text.includes(x);
    check(`search ?q= reflects escaped (${x.slice(0, 14)}…)`, r.status === 200 && !raw, `status ${r.status}${raw ? " RAW PAYLOAD IN HTML" : ""}`);
    if (hasBrowser) {
      for (const u of [`/search?q=${q}`, `/ar/search?q=${q}`, `/track-order?number=${q}&phone=${q}`, `/products/${q}`, `/collections/${q}`, `/pages/${q}`]) {
        const { ctx, log } = await openPage(u, { wait: 800 });
        check(`no XSS dialog on ${u.slice(0, 40)}`, !log.dialogs.length, log.dialogs.join(","));
        await ctx.close();
      }
    }
  }
}

async function injection() {
  const payloads = ["' OR 1=1 --", `{"$gt":""}`, "1; DROP TABLE orders", "../../../../etc/passwd", "%00", "VD-1' UNION SELECT * FROM sec_sessions --"];
  for (const p of payloads) {
    const e = encodeURIComponent(p);
    for (const u of [`/search?q=${e}`, `/api/orders/track?number=${e}&phone=${e}`, `/api/orders/track?number=VD-524908&phone=${e}`, `/products/${e}`, `/api/checkouts/${e}`, `/media/${e}`]) {
      const r = await req(u);
      check(`injection ${u.slice(0, 50)}`, r.status < 500 && noLeak(r) && !(r.data && r.data.timeline), `status ${r.status}`);
    }
  }
  // NoSQL-style / type-confusion objects in JSON fields
  const objs = [
    ["/api/orders/track?number[$gt]=&phone[$gt]=", null],
    ["/api/promo", { code: { $gt: "" } }],
    ["/api/promo", { code: "' OR 1=1 --" }],
    ["/api/subscribe", { contact: { $gt: "" } }],
    ["/api/contact", { name: { $gt: "" }, message: ["x"], phone: { $ne: null } }],
    ["/api/orders", { lines: [{ productId: { $gt: "" }, qty: 1 }], customer: { name: "A B", phone: "01012345678" } }],
    ["/api/orders/VD-1%27%20OR%201=1--/add", { phone: { $gt: "" }, productId: "p01" }],
    ["/api/reviews", { productId: { $gt: "" }, rating: "5", body: "x".repeat(20), name: "ab" }],
  ];
  for (const [u, body] of objs) {
    const r = body ? await req(u, { method: "POST", json: body }) : await req(u);
    check(`type-confusion ${u.slice(0, 40)} ${body ? JSON.stringify(body).slice(0, 30) : ""}`, r.status >= 400 && r.status < 500 && noLeak(r), `status ${r.status}`);
  }
}

const GOOD_ADDR = { governorate: "Cairo", city: "Nasr City", street: "Security Test St", building: "1" };
const testPhone = () => `0109${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
function goodOrder(over = {}) {
  return { lines: [{ productId: "p01", color: "Black", size: "XL", qty: 1 }], customer: { name: `Sec ${NONCE}`, phone: testPhone() }, address: GOOD_ADDR, shipping: "standard", payment: "cod", ...over };
}
const placed = (r) => {
  if (r.status === 201 && r.data?.order?.number) created.orders.push(r.data.order.number);
  return r.status === 201;
};

async function tampering() {
  // all of these must be rejected — nothing stored (any 201 is recorded and cleaned up)
  const bad = {
    "qty -1": { lines: [{ productId: "p01", color: "Black", size: "XL", qty: -1 }] },
    "qty 0": { lines: [{ productId: "p01", color: "Black", size: "XL", qty: 0 }] },
    "qty 1e9": { lines: [{ productId: "p01", color: "Black", size: "XL", qty: 1e9 }] },
    "qty 21": { lines: [{ productId: "p01", color: "Black", size: "XL", qty: 21 }] },
    "qty NaN string": { lines: [{ productId: "p01", color: "Black", size: "XL", qty: "abc" }] },
    "qty Infinity": { lines: [{ productId: "p01", color: "Black", size: "XL", qty: "Infinity" }] },
    "unknown product": { lines: [{ productId: "p999", color: "Black", size: "XL", qty: 1 }] },
    "SQLi product id": { lines: [{ productId: "' OR 1=1 --", color: "Black", size: "XL", qty: 1 }] },
    "unknown colour": { lines: [{ productId: "p01", color: "Gold", size: "XL", qty: 1 }] },
    "unknown size": { lines: [{ productId: "p01", color: "Black", size: "XXXXL", qty: 1 }] },
    "empty lines": { lines: [] },
    "51 lines": { lines: Array.from({ length: 51 }, () => ({ productId: "p01", color: "Black", size: "XL", qty: 1 })) },
    "lines not array": { lines: { 0: { productId: "p01" } } },
    "line is string": { lines: ["p01"] },
    "unknown governorate": { address: { ...GOOD_ADDR, governorate: "Atlantis" } },
    "payment disabled in settings (installments)": { payment: "installments" },
    "payment unknown": { payment: "bitcoin" },
    "payment prepaid tamper": { payment: "' OR 1=1 --" },
    "customer as string": { customer: "x" },
    "bad phone": { customer: { name: "Sec Test", phone: "123" } },
  };
  for (const [name, over] of Object.entries(bad)) {
    const r = await req("/api/orders", { method: "POST", json: goodOrder(over) });
    check(`order tamper: ${name} → rejected`, !placed(r) && r.status >= 400 && r.status < 500 && noLeak(r), `status ${r.status}`);
  }
  // over-stock qty for a variant (20 per line but split across lines)
  const r = await req("/api/orders", { method: "POST", json: goodOrder({ lines: Array.from({ length: 50 }, () => ({ productId: "p01", color: "Black", size: "XL", qty: 20 })) }) });
  check("order tamper: 1000 units of one variant → stock check", !placed(r) && r.status === 409, `status ${r.status}`);
}

async function storedOrder() {
  // ONE real order carrying every client-side lie at once + XSS in name/address — must be re-priced on the server
  const phone = testPhone();
  const body = {
    ...goodOrder(),
    lines: [{ productId: "p01", color: "Black", size: "XL", qty: 1, price: 1, unit: 1, total: 1, compareAt: 1 }],
    customer: { name: `${XSS[0]} Sec${NONCE}`, phone, email: `sec+${NONCE}@example.com` },
    address: { ...GOOD_ADDR, street: XSS[1], building: XSS[0], notes: `${NONCE} ${XSS[1]}` },
    shipping: "free",
    promoCode: "FAKE100PCT",
    protection: "yes",
    bump: false,
    total: 1,
    subtotal: 1,
    discount: 999999,
    totals: { total: 1, shipping: 0 },
  };
  const r = await req("/api/orders", { method: "POST", json: body });
  if (!placed(r)) return check("server re-prices tampered order", false, `status ${r.status} ${r.text.slice(0, 120)}`);
  const o = r.data.order;
  const p = JSON.parse(snap.products.get("p01"));
  const v = (p.variants ?? []).find((x) => x.color === "Black" && x.size === "XL");
  const expectUnit = v?.price ?? p.price;
  check("order: unit price from DB, client price ignored", o.lines[0].unit === expectUnit && o.lines[0].unit > 1, `unit ${o.lines[0].unit} vs DB ${expectUnit}`);
  check("order: total recomputed (client total=1 ignored)", o.totals.total >= expectUnit && o.totals.total !== 1, `total ${o.totals.total}`);
  check("order: fake promo ignored", !o.promoCode && !o.totals.promoDiscount, `promo ${o.promoCode} ${o.totals.promoDiscount}`);
  check("order: bogus shipping → standard", o.shipping === "standard", o.shipping);
  check("order: protection only when === true", !o.totals.protection, `protection ${o.totals.protection}`);
  check("order: XSS stored as inert text", o.customer.name.includes("<script>"), "React escapes on render (admin + thank-you)");
  const num = o.number;
  const n = Number(num.slice(3));

  // IDOR — tracking & post-purchase add with a wrong phone or neighbouring numbers
  const wrong = "01011111111";
  const t1 = await req(`/api/orders/track?number=${num}&phone=${wrong}`);
  check("IDOR track: right number, wrong phone → 404, no data", t1.status === 404 && !t1.data?.timeline, `${t1.status}`);
  let leak = 0;
  const trackIp = ip();
  for (const k of [n - 2, n - 1, n + 1, n + 2]) {
    const t = await req(`/api/orders/track?number=VD-${k}&phone=${phone}`, { xff: trackIp });
    if (t.data?.timeline) leak++;
  }
  check("IDOR track: sequential numbers with this phone → nothing", !leak, `${leak} leaked`);
  const t2 = await req(`/api/orders/track?number=${num}&phone=${phone}`);
  const keys = Object.keys(t2.data ?? {});
  check("track (owner) returns no PII", t2.status === 200 && !keys.some((k) => /customer|phone|name|address|street|email/.test(k)) && !t2.text.includes(phone), keys.join(","));
  const a1 = await req(`/api/orders/${num}/add`, { method: "POST", json: { phone: wrong, productId: "p02", color: "Black", size: "M" } });
  check("IDOR add-to-order: wrong phone → 404", a1.status === 404, `${a1.status}`);
  if (snap.orderNumbers[0]) {
    const a2 = await req(`/api/orders/${snap.orderNumbers[0]}/add`, { method: "POST", json: { phone, productId: "p02", color: "Black", size: "M" } });
    check("IDOR add-to-order: someone else's order → 404", a2.status === 404, `${a2.status}`);
  }

  // rendered thank-you page from the stored order: payload must show as text, no dialog
  if (await getBrowser()) {
    const { page, ctx, log } = await openPage("/checkout/thank-you", {
      wait: 1500,
      before: async (pg) => {
        await pg.goto(BASE + "/robots.txt");
        await pg.evaluate((ord) => sessionStorage.setItem("vedra:lastOrder", JSON.stringify(ord)), o);
      },
    });
    const txt = await page.evaluate(() => document.body.innerText);
    const injected = await page.evaluate(() => !!document.querySelector('img[src="x"]') || [...document.scripts].some((s) => s.textContent.includes("alert(1)")));
    check("thank-you page renders order XSS as text", !log.dialogs.length && !injected, `${log.dialogs.length} dialogs, injected=${injected}, payload-visible=${txt.includes("<script>") || txt.includes("onerror")}`);
    await ctx.close();
    const home = await openPage("/", { wait: 6000 });
    check("home (recent-purchase toast) — no XSS dialog", !home.log.dialogs.length, home.log.dialogs.join(","));
    await home.ctx.close();
  }
}

async function storedXssOther() {
  // contact form through the real UI
  if (await getBrowser()) {
    const { page, ctx, log } = await openPage("/pages/contact", { wait: 800 });
    try {
      await page.fill("#c-name", `${XSS[0]} ${NONCE}`);
      await page.fill("#c-email", `sec+${NONCE}@example.com`);
      await page.fill("#c-message", `${XSS[1]} ${XSS[0]} security test ${NONCE}`);
      const resP = page.waitForResponse((r) => r.url().endsWith("/api/contact"), { timeout: 8000 });
      await page.locator("#c-message").evaluate((el) => el.form.requestSubmit());
      const res = await resP;
      const j = await res.json().catch(() => ({}));
      if (j.id) created.messages.push(j.id);
      await page.waitForTimeout(800);
      check("contact form XSS (UI) stored as text, no dialog", res.status() === 201 && !log.dialogs.length, `status ${res.status()} id ${j.id}`);
    } catch (e) {
      check("contact form XSS (UI)", false, String(e).slice(0, 120));
    }
    await ctx.close();
  } else {
    const r = await req("/api/contact", { method: "POST", json: { name: `${XSS[0]} ${NONCE}`, email: `sec+${NONCE}@example.com`, message: `${XSS[1]} ${NONCE} security test` } });
    if (r.data?.id) created.messages.push(r.data.id);
    check("contact XSS (API) accepted as text", r.status === 201, `${r.status}`);
  }
  // newsletter: markup in an email is rejected outright
  for (const x of XSS) {
    const r = await req("/api/subscribe", { method: "POST", json: { contact: `${NONCE}${x}@example.com` } });
    check(`newsletter rejects markup (${x.slice(0, 10)}…)`, r.status === 400, `${r.status}`);
  }
  // review (JSON) — saved pending (never public until approved)
  const rv = await req("/api/reviews", { method: "POST", json: { productId: "p01", rating: 5, title: XSS[0], body: `${XSS[1]} security test ${NONCE}`, name: `Sec${NONCE} Tester`, city: XSS[1] } });
  check("review XSS stored as pending text", rv.status === 201, `${rv.status}`);
}

async function uploads() {
  const fields = (fd) => {
    fd.set("productId", "p01");
    fd.set("rating", "5");
    fd.set("body", `security upload test ${NONCE}`);
    fd.set("name", `Sec${NONCE} Upload`);
    return fd;
  };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const cases = [
    ["evil.html", "text/html", Buffer.from("<html><script>alert(1)</script></html>")],
    ["evil.svg", "image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>')],
    ["shell.php.jpg", "image/jpeg", Buffer.from("<?php system($_GET['c']); ?>")],
    ["shell.php", "application/x-php", Buffer.from("<?php echo 1; ?>")],
    ["polyglot.png", "image/png", Buffer.concat([png, Buffer.from("<script>alert(1)</script>".repeat(4))])],
    ["big.jpg", "image/jpeg", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(9 * 1024 * 1024)])],
  ];
  for (const [name, type, buf] of cases) {
    const fd = fields(new FormData());
    fd.append("photos", new Blob([buf], { type }), name);
    const r = await req("/api/reviews", { method: "POST", body: fd });
    check(`upload ${name} → rejected`, r.status >= 400 && r.status < 500 && noLeak(r), `${r.status} ${r.data?.error ?? ""}`.slice(0, 90));
  }
  const fd = fields(new FormData());
  for (let i = 0; i < 4; i++) fd.append("photos", new Blob([Buffer.from("junkjunkjunkjunk")], { type: "image/jpeg" }), `${i}.jpg`);
  const r4 = await req("/api/reviews", { method: "POST", body: fd });
  check("upload 4 photos (max 3) → rejected", r4.status === 400, `${r4.status}`);
  const huge = await req("/api/reviews", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: Buffer.alloc(26 * 1024 * 1024, 0x61) });
  check("upload body 26 MB → 413", huge.status === 413, `${huge.status}`);
  // review-link endpoint: token needed (issued from admin) — reachable rejection paths only
  const tk = new FormData();
  tk.set("token", "not-a-real-token");
  tk.set("items", "[]");
  const t = await req("/api/reviews/request", { method: "POST", body: tk });
  check("review-link bogus token → 410", t.status === 410, `${t.status}`);
  const big = await req("/api/reviews/request", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: Buffer.alloc(49 * 1024 * 1024, 0x61) });
  check("review-link body 49 MB → 413", big.status === 413, `${big.status}`);
  const j = await req("/api/reviews/request", { method: "POST", json: { token: "x" } });
  check("review-link JSON body → 415", j.status === 415, `${j.status}`);
  // media route only serves rasters
  for (const u of ["/media/x.svg", "/media/x.html", "/media/..%2f..%2fvedra.db", "/media/reviews/..%2f..%2f.env.local", "/media/vedra.db"]) {
    const m = await req(u);
    check(`media ${u} → 404`, m.status === 404, `${m.status}`);
  }
}

async function csrf() {
  const cross = { origin: "https://evil.example", "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" };
  const posts = [
    ["/api/contact", { name: "Sec Test", email: `sec+${NONCE}@example.com`, message: `csrf test ${NONCE} message` }],
    ["/api/subscribe", { contact: `sec+${NONCE}@example.com` }],
    ["/api/orders", goodOrder()],
    ["/api/promo", { code: "WELCOME10" }],
    ["/api/checkouts", { id: `sec${NONCE}aaaaaaaaaa`, customer: { phone: "01012345678" }, lines: [{ productId: "p01", qty: 1 }] }],
    ["/api/reviews", { productId: "p01", rating: 5, body: `csrf test ${NONCE} body`, name: "Sec Test" }],
    ["/api/orders/VD-100000/add", { phone: "01011111111", productId: "p02", size: "M" }],
  ];
  for (const [u, body] of posts) {
    const r = await req(u, { method: "POST", headers: cross, json: body });
    if (r.status === 201 && r.data?.order?.number) created.orders.push(r.data.order.number);
    check(`CSRF ${u} (Sec-Fetch-Site: cross-site) → 403`, r.status === 403, `${r.status}`);
  }
  const fd = new FormData();
  fd.set("token", "x");
  const m = await req("/api/reviews/request", { method: "POST", headers: cross, body: fd });
  check("CSRF /api/reviews/request multipart → 403", m.status === 403, `${m.status}`);
  // legacy browsers without Fetch Metadata: a foreign Origin alone must be refused too
  const o = await req("/api/subscribe", { method: "POST", headers: { origin: "https://evil.example" }, json: { contact: `${NONCE}x` } });
  check("CSRF foreign Origin without Sec-Fetch-Site → 403", o.status === 403, `${o.status}`);
}

async function errors() {
  const cases = [
    ["bad JSON", "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad json" }, 400],
    ["JSON array", "/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: "[1,2]" }, 400],
    ["wrong content-type", "/api/contact", { method: "POST", headers: { "content-type": "text/xml" }, body: "<x/>" }, 415],
    ["huge body orders 1 MB", "/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: `{"a":"${"x".repeat(1024 * 1024)}"}` }, 413],
    ["huge body no content-length", "/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: new Blob([`{"a":"${"x".repeat(200_000)}"}`]).stream(), duplex: true }, 413],
    ["deep JSON nesting", "/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: "[".repeat(8_000) }, 400],
    ["GET on POST route", "/api/orders", {}, 405],
    ["unknown API", "/api/does-not-exist", {}, 404],
    ["broken product", "/products/%E0%A4%A", {}, null],
    ["unknown page", "/this/does/not/exist", {}, 404],
    ["bad checkout id", "/api/checkouts/%00%00", {}, null],
  ];
  for (const [name, u, o, expect] of cases) {
    let r;
    if (o.duplex) {
      const res = await fetch(BASE + u, { method: "POST", headers: { ...o.headers, "x-forwarded-for": ip() }, body: o.body, duplex: "half" });
      r = { status: res.status, text: await res.text() };
    } else r = await req(u, o);
    // malformed %-encoding → Next core answers a bare "Internal Server Error" (no details) before app code runs: accepted
    const bare500 = r.status === 500 && /^Internal Server Error\s*$/.test(r.text);
    const ok = (expect ? r.status === expect : r.status < 500 || bare500) && noLeak(r);
    check(`error handling: ${name}`, ok, `${r.status}${noLeak(r) ? "" : " LEAKS STACK/PATH"}`);
  }
}

async function spam() {
  const burst = async (u, body, n, limit) => {
    const x = ip();
    const codes = [];
    for (let i = 0; i < n; i++) codes.push((await req(u, { method: "POST", json: body, xff: x })).status);
    const first429 = codes.indexOf(429);
    check(`spam ${n}× ${u} → 429 after ${limit}`, first429 === limit && codes.slice(first429).every((c) => c === 429) && !codes.includes(201), `first 429 at #${first429 + 1}`);
  };
  // invalid bodies: the limiter runs first, so nothing is ever stored
  await burst("/api/contact", { name: "x" }, 50, 5);
  await burst("/api/subscribe", { contact: "nope" }, 50, 6);
  await burst("/api/orders", { lines: [] }, 50, 20);
  await burst("/api/promo", { code: "NOPE" }, 50, 12);
  await burst("/api/reviews", { productId: "nope" }, 20, 4);
  const x = ip();
  let first = -1;
  for (let i = 0; i < 35; i++) if ((await req(`/api/orders/track?number=VD-${100000 + i}&phone=01012345678`, { xff: x })).status === 429 && first < 0) first = i;
  check("track-order enumeration → 429 after 30", first === 30, `first 429 at #${first + 1}`);
}

function adminRoutes() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, ".next/server/app-paths-manifest.json"), "utf8"));
    return [...new Set(Object.keys(m).map((k) => k.replace(/\/(page|route)$/, "").replace(/\/\([^)]+\)/g, "") || "/").filter((k) => k.startsWith("/admin") && !k.startsWith("/admin/login")))];
  } catch {
    return ["/admin", "/admin/orders", "/admin/products", "/admin/settings", "/admin/messages", "/admin/orders/export", "/admin/backup/export"];
  }
}

async function authz() {
  const sent = sentinels();
  const leaks = (t) => sent.filter((s) => t.includes(s));
  const routes = adminRoutes().map((r) => r.replace(/\[[^\]]+\]/g, snap.orderNumbers?.[0] ? `o_${snap.orderNumbers[0]}` : "x"));
  const variants = [
    ["logged out", {}],
    ["bogus cookie", { cookie: "vedra_admin=bogus; __Host-vedra_admin=bogus" }],
    ["forged-looking cookie", { cookie: `vedra_admin=${"a".repeat(64)}` }],
    ["x-middleware-subrequest", { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" }],
    ["x-middleware-subrequest proxy", { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" }],
    ["x-middleware-subrequest src/middleware", { "x-middleware-subrequest": "src/middleware:src/middleware:src/middleware:src/middleware:src/middleware" }],
  ];
  let bad = [];
  let n = 0;
  for (const [label, headers] of variants) {
    for (const r of [...routes, "/api/admin/live"]) {
      const res = await req(r, { headers });
      n++;
      const loc = res.headers.get("location") ?? "";
      const blocked = res.status === 401 || res.status === 404 || ([302, 303, 307, 308].includes(res.status) && loc.includes("/admin/login")) || (res.status === 200 && /NEXT_REDIRECT|\/admin\/login/.test(res.text) && !leaks(res.text).length);
      if (!blocked || leaks(res.text).length) bad.push(`${label} ${r} ${res.status}`);
    }
  }
  check(`admin pages/APIs blocked without a valid session (${n} requests, ${routes.length} routes × ${variants.length} variants)`, !bad.length, bad.slice(0, 5).join("; "));

  // server actions with a bogus cookie (passes the proxy's cookie-presence check → must hit guard())
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")).node ?? {};
  } catch {}
  const find = (name) => Object.entries(manifest).find(([, e]) => e.exportedName === name);
  for (const [name, route, marker] of [
    ["getSecurityOverview", "/admin/settings", /recoveryLeft|twoFactor|sessions/],
    ["listLibrary", "/admin/media", /usedBy|\/p\/|images\.unsplash/],
  ]) {
    const hit = find(name);
    if (!hit) {
      skip(`server action ${name} w/o session`, "id not found in server-reference-manifest");
      continue;
    }
    for (const cookie of ["vedra_admin=bogus", ""]) {
      const r = await req(route, { method: "POST", headers: { "next-action": hit[0], "content-type": "text/plain;charset=UTF-8", origin: BASE, accept: "text/x-component", ...(cookie ? { cookie } : {}) }, body: "[]" });
      check(`server action ${name} ${cookie ? "bogus cookie" : "no cookie"} → no data`, !marker.test(r.text) && !leaks(r.text).length, `${r.status} ${r.headers.get("x-action-redirect") ?? r.headers.get("location") ?? ""}`);
    }
  }
}

async function openRedirect() {
  const src = fs.readFileSync(path.join(ROOT, "src/app/admin/login/actions.ts"), "utf8");
  const m = src.match(/return (\/\^.*\$\/)\.test\(n\) && !n\.includes\("\/\/"\)/);
  if (m) {
    const re = eval(m[1]);
    const safeNext = (n) => (re.test(n) && !n.includes("//") ? n : "/admin");
    const evil = ["https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "/admin//evil.com", "/admin/../\\evil.com", "/admin@evil.com", "javascript:alert(1)", "/admin/%2F%2Fevil.com", "/admin\n//evil.com", " /admin", "/admin/x?next=https://evil.com&y=//"];
    const out = evil.filter((e) => safeNext(e) !== "/admin" && !/^\/admin(\/|$|\?)/.test(safeNext(e)));
    const slash = evil.map(safeNext).filter((v) => v.includes("//") || v.includes("\\") || /^[a-z]+:/i.test(v));
    check("login next= sanitizer (safeNext) blocks off-site targets", !out.length && !slash.length, `${evil.length} payloads`);
  } else skip("login next= sanitizer", "regex not found in actions.ts");
  for (const u of ["/admin//evil.com", "/admin/\\evil.com", "/admin/%2F%2Fevil.com", "/admin/login?next=https://evil.com", "/admin/login?next=//evil.com", "//evil.com/admin", "/en//evil.com", "/%2F%2Fevil.com"]) {
    const r = await req(u);
    const loc = r.headers.get("location") ?? "";
    let host = "";
    try {
      host = new URL(loc, BASE).host;
    } catch {}
    check(`open redirect ${u}`, !loc || host === new URL(BASE).host, `${r.status} ${loc.slice(0, 60)}`);
  }
}

async function bruteForce() {
  if (!db) return skip("login brute force / lockout", "needs local DB to restore throttle rows");
  if (!(await getBrowser())) return skip("login brute force / lockout", "playwright-core not available (needed to capture the login action)");
  const x = ip();
  const { page, ctx } = await openPage("/admin/login", { xff: x, wait: 500 });
  let captured = null;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && !captured) captured = { headers: r.headers(), body: r.postDataBuffer() };
  });
  const setCookies = [];
  page.on("response", async (r) => {
    const sc = (await r.allHeaders().catch(() => ({})))["set-cookie"];
    if (sc) setCookies.push(sc);
  });
  await page.fill("#password", `wrong-${NONCE}`);
  await page.locator("#password").press("Enter");
  await page.waitForTimeout(1500);
  await ctx.close();
  if (!captured) return check("login brute force", false, "could not capture login server action");
  const send = (xff, extra = {}) => {
    const h = { ...captured.headers, "x-forwarded-for": xff, ...extra };
    for (const k of ["content-length", "cookie", "host", "connection", "keep-alive", "transfer-encoding", "upgrade"]) delete h[k];
    return req("/admin/login", { method: "POST", headers: h, body: captured.body, xff });
  };
  let last;
  for (let i = 0; i < 19; i++) last = await send(x);
  const row = db.prepare("SELECT fails, locked_until FROM sec_throttle WHERE key = ?").get(`ip:${x}`);
  const locked = row && row.locked_until > Date.now();
  check("login: 20 wrong passwords → lockout", locked && /Too many failed attempts|lockout|محاولات/i.test(last.text), `fails=${row?.fails} locked=${locked}`);
  check("login: no Set-Cookie on failed sign-in", !setCookies.some((c) => /vedra_admin=/.test(c)) && !last.headers.get("set-cookie"), setCookies.join(" | ").slice(0, 100));
  // CSRF on the server action itself: foreign Origin → Next refuses before the action runs (no throttle row appears)
  const y = ip();
  const c = await send(y, { origin: "https://evil.example", "sec-fetch-site": "cross-site" });
  const ran = db.prepare("SELECT 1 FROM sec_throttle WHERE key = ?").get(`ip:${y}`);
  check("server action with foreign Origin is not executed", !ran, `status ${c.status}`);
}

/* ───────────────────────── main ───────────────────────── */
(async () => {
  console.log(`Security tests → ${BASE}  (${WRITES ? "full: creates + deletes test rows" : "safe: nothing stored"}, run ${RUN}, nonce ${NONCE})\n`);
  if (LOCAL) dbOpen();
  if (db) snapshotBefore();
  else snap.orderNumbers = [];
  try {
    await headersTest();
    await bundleGrep();
    await cspBrowser();
    await reflectedXss();
    await injection();
    await tampering();
    if (WRITES) {
      await storedOrder();
      await storedXssOther();
    } else skip("stored XSS + re-priced order + IDOR on a real order", "--safe / non-local");
    await uploads();
    await csrf();
    await errors();
    await spam();
    await authz();
    await openRedirect();
    await bruteForce();
  } catch (e) {
    check("test run", false, String(e?.stack ?? e).slice(0, 300));
  } finally {
    if (browser) await browser.close().catch(() => {});
    cleanup();
  }
  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} passed${fails.length ? ` — FAILED: ${fails.map((f) => f.name).join(" | ")}` : ""}`);
  process.exit(fails.length ? 1 : 0);
})();
