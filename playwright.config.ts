import { defineConfig, devices } from "@playwright/test";

/**
 * Cross-browser E2E matrix (checklist 6c). Runs against an already running build — it never starts one:
 *   npm run build && npx next start -p 3000      (in another terminal)
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 * Browsers: `npx playwright install chromium firefox webkit` once.
 * The flow test never places an order (POST /api/orders is intercepted and answered locally).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),
    locale: "en-US",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "ipad", use: { ...devices["iPad (gen 7)"] } },
  ],
});
