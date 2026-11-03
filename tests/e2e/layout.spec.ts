import { expect, test } from "@playwright/test";

/**
 * Every key page × width × language: no horizontal page scroll and exactly one h1.
 * Runs in each browser project (the project's own viewport is replaced by the sweep).
 * WIDTHS=280,390 npx playwright test layout --project=chromium   to narrow a run.
 */
const WIDTHS = (process.env.WIDTHS || "280,320,360,390,430,768,1024,1440,1920,2560,3840").split(",").map(Number);
const PAGES = ["/", "/collections/all", "/products/heavyweight-hoodie", "/cart", "/checkout", "/pages/faq", "/search?q=hoodie"];
const CART = JSON.stringify({ cart: [{ key: "p01|Black|M", productId: "p01", color: "Black", size: "M", qty: 2 }], wishlist: [], recent: [], promo: null });

for (const lang of ["en", "ar"]) {
  for (const path of PAGES) {
    test(`${lang} ${path} — no horizontal scroll`, async ({ page }) => {
      await page.addInitScript((cart) => {
        try {
          localStorage.setItem("verda:welcome", String(Date.now()));
          localStorage.setItem("verda:v1", cart);
        } catch {}
      }, CART);
      await page.route("**/api/recent-purchases**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
      const url = lang === "ar" ? `/ar${path === "/" ? "" : path}` : path;
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: w < 600 ? 800 : Math.max(800, Math.round((w * 9) / 16)) });
        await page.goto(url, { waitUntil: "load" });
        // client-rendered pages (the checkout waits for the saved bag to hydrate) get their h1 after "load":
        // wait for the hydrated page, then measure it
        await expect(page.locator("h1"), `${url} @${w}px h1 count`).toHaveCount(1);
        // measure the settled layout: on a first load the web fonts may still be swapping in (font-display: swap)
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const { sw, iw, culprits } = await page.evaluate(() => {
          const iw = window.innerWidth;
          const cw = document.documentElement.clientWidth;
          // elements reaching past the viewport that no clipping / scrolling ancestor below <body> contains (named on
          // failure; <body> clips horizontally, so whatever still overflows escapes it, e.g. viewport-positioned boxes)
          const contained = (el: Element) => {
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
              const cs = getComputedStyle(a);
              if (cs.overflowX !== "visible" || cs.position === "fixed") return true;
            }
            return false;
          };
          const culprits = [...document.querySelectorAll("body *")]
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ el, r }) => r.width > 0 && r.right > cw + 0.5 && !contained(el))
            .sort((x, y) => y.r.right - x.r.right)
            .slice(0, 6)
            .map(({ el, r }) => `<${el.tagName.toLowerCase()} ${getComputedStyle(el).position} class="${String(el.getAttribute("class") ?? "").slice(0, 70)}"> ${Math.round(r.left)}→${Math.round(r.right)} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
          return { sw: document.documentElement.scrollWidth, iw, culprits: [`clientWidth ${cw}`, ...culprits] };
        });
        expect(sw, `${url} @${w}px; outside the viewport: ${culprits.join(" | ") || "none found"}`).toBeLessThanOrEqual(iw);
      }
    });
  }
}
