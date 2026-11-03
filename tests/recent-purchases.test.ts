import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/*
 * The storefront "recent purchase" toast (GET /api/recent-purchases) must only show real orders the store has
 * confirmed: no pending, draft, cancelled, returned or demo orders. Runs against a throwaway SQLite file.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-test-"));
process.env.VERDA_DB = path.join(dir, "store.db");
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("only confirmed-or-later, non-demo orders from the window are listed", async () => {
  const { getDb, recentPurchases } = await import("@/server/store");
  const db = getDb();
  const insert = db.prepare("INSERT INTO orders (id, number, created_at, status, phone, total, demo, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const add = (n: number, status: string, { demo = 0, hoursAgo = 1 } = {}) => {
    const createdAt = new Date(Date.now() - hoursAgo * 36e5 - n * 1000).toISOString();
    const data = { id: `o${n}`, number: `T-${n}`, createdAt, status, customer: { name: `Name${n} Surname` }, address: { governorate: "Cairo" }, lines: [{ productId: "p01" }] };
    insert.run(`o${n}`, `T-${n}`, createdAt, status, `0100000000${n}`, 100, demo, JSON.stringify(data));
  };
  add(1, "pending");
  add(2, "draft");
  add(3, "cancelled");
  add(4, "returned");
  add(5, "confirmed", { demo: 1 });
  add(6, "confirmed", { hoursAgo: 72 });
  add(7, "confirmed");
  add(8, "packed");
  add(9, "shipped");
  add(10, "delivered");

  const items = recentPurchases(48, 20);
  assert.deepEqual(items.map((i) => i.first).sort(), ["Name10", "Name7", "Name8", "Name9"]);
  for (const i of items) assert.deepEqual(Object.keys(i).sort(), ["at", "first", "governorate", "productId"]);
});
