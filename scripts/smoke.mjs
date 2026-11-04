#!/usr/bin/env node
/**
 * Storefront smoke test (read-only — it NEVER places an order):
 *   home → collection → product → pick colour/size → add to bag → /cart shows the line and a total.
 * Also fails on uncaught page errors, console errors and same-origin 4xx/5xx responses.
 *
 *   BASE_URL=http://localhost:3000 npm run test:smoke          (default BASE_URL: http://localhost:3000)
 *   HEADED=1 … to watch it.
 *
 * Needs Playwright: `npm i -D playwright-core && npx playwright-core install chromium`
 * (or set PLAYWRIGHT_MODULE=/abs/path/to/node_modules/playwright-core to reuse an install elsewhere).
 */
import { createRequire } from "node:module";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const require = createRequire(path.join(process.cwd(), "package.json"));

async function loadPlaywright() {
  for (const id of [process.env.PLAYWRIGHT_MODULE, "playwright-core", "playwright"].filter(Boolean)) {
    try {
      return require(id);
    } catch {}
  }
  console.error("Playwright not found. Install it with:\n  npm i -D playwright-core && npx playwright-core install chromium");
  process.exit(2);
}

const { chromium } = await loadPlaywright();
// Playwright's own Chromium if downloaded, else the installed Google Chrome
const browser = await chromium.launch({ headless: !process.env.HEADED }).catch(() => chromium.launch({ headless: !process.env.HEADED, channel: "chrome" }));
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "en-US" });
const page = await ctx.newPage();
// mark the welcome pop-up as already seen so it can't cover the buttons (components/layout/overlays.tsx)
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("vedra:welcome", String(Date.now()));
  } catch {}
});
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("response", (r) => r.url().startsWith(BASE) && r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));
// belt and braces: this script must never create an order
await page.route("**/api/orders**", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));

const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    console.log(`✔ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    console.error(`✖ ${name}: ${e.message}`);
    await page.screenshot({ path: "smoke-failure.png", fullPage: false }).catch(() => {});
    await browser.close();
    process.exit(1);
  }
};

let productUrl = "";
await step("home renders", async () => {
  const res = await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  if (!res?.ok()) throw new Error(`status ${res?.status()}`);
  await page.locator("h1").first().waitFor();
});

await step("collection lists products", async () => {
  const link = page.locator('a[href^="/collections/"]').first();
  const href = (await link.getAttribute("href")) ?? "/collections/all";
  await page.goto(`${BASE}${href.split("?")[0]}`, { waitUntil: "domcontentloaded" });
  const card = page.locator('main a[href^="/products/"]').first();
  await card.waitFor();
  productUrl = (await card.getAttribute("href")) ?? "";
  if (!productUrl) throw new Error("no product link");
});

await step("product page: h1 + price", async () => {
  await page.goto(`${BASE}${productUrl}`, { waitUntil: "load" }); // wait for hydration before interacting
  await page.locator("h1").first().waitFor();
  const html = await page.content();
  if (!/EGP\s?[\d,]+/.test(html)) throw new Error("no EGP price on the page");
  if (!html.includes("application/ld+json")) throw new Error("no JSON-LD");
});

await step("pick an in-stock size and add to bag", async () => {
  const sizes = page.locator('[role="radiogroup"][aria-labelledby="size-label"] [role="radio"]:not([disabled])'); // components/pdp/size-selector.tsx
  await sizes.first().waitFor();
  const n = await sizes.count();
  for (let i = 0; i < n; i++) {
    const label = (await sizes.nth(i).getAttribute("aria-label")) ?? "";
    if (/notify|sold/i.test(label)) continue;
    await sizes.nth(i).click();
    break;
  }
  await page.getByRole("button", { name: /add to bag/i }).first().click();
  // cart store (src/lib/store.ts) persists to localStorage "vedra:v1" → { cart: [{ productId, … }] }
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("vedra:v1") ?? "{}").cart ?? []).length > 0, null, { timeout: 8000 });
});

await step("cart shows the line and totals", async () => {
  await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
  await page.getByText(/^Total$/).first().waitFor({ timeout: 10_000 });
  const text = await page.locator("main").innerText();
  const amounts = [...text.matchAll(/EGP\s?([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  if (!amounts.length || amounts.some((a) => !Number.isFinite(a))) throw new Error("no EGP amounts in the cart");
  if (!productUrl || !(await page.locator(`main a[href^="${productUrl.split("?")[0]}"]`).count())) throw new Error("added product not listed in the cart");
});

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s) seen while browsing:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`\nSmoke test passed against ${BASE}`);
