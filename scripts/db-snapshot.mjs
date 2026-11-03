// Copies the local store DB (data/verda.db) to deploy/verda.db for Vercel, minus anything private: admin password and
// sessions, orders, checkouts, subscribers, messages, the activity log and every security table. Catalog, reviews,
// content and settings stay. On Vercel, store.ts copies this file into the empty /tmp DB path on first open.
// Run before deploying: npm run db:snapshot   (VERDA_DB=deploy/verda.db re-sanitizes the shipped snapshot in place)
//
// The published snapshot is also normalised so the demo can't mislead:
// - cash on delivery only: no payment gateway is integrated, so card / wallet / installments are switched off;
// - sample reviews (demo: true) are never shown as "Verified buyer";
// - migration markers keep only their date (their backup paths point into the machine that made the snapshot).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const src = path.resolve(process.env.VERDA_DB ?? path.join(process.cwd(), "data", "verda.db"));
const out = path.join(process.cwd(), "deploy", "verda.db");
const tmp = `${out}.${process.pid}.tmp`;
const PRIVATE = ["orders", "checkouts", "subscribers", "messages", "activity", "review_requests", "media"];

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(tmp, { force: true });
new DatabaseSync(src, { readOnly: true }).exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`);

const db = new DatabaseSync(tmp);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
for (const t of tables) if (PRIVATE.includes(t) || t.startsWith("sec_")) db.exec(`DELETE FROM "${t}"`);
db.exec("DELETE FROM kv WHERE key LIKE 'password%' OR key LIKE 'session%' OR key = 'setup_guide_dismissed'");
db.exec("UPDATE kv SET value = json_object('at', json_extract(value, '$.at')) WHERE key LIKE 'migration:%'");
db.exec(`UPDATE kv SET value = json_set(value, '$.payments.card', json('false'), '$.payments.wallet', json('false'), '$.payments.installments', json('false'), '$.payments.cod', json('true'))
         WHERE key = 'settings' AND json_extract(value, '$.payments') IS NOT NULL`);
if (tables.includes("reviews")) db.exec("UPDATE reviews SET data = json_set(data, '$.verified', json('false')) WHERE json_extract(data, '$.demo') = 1");
db.exec("VACUUM");
const n = (t, where = "") => (tables.includes(t) ? db.prepare(`SELECT COUNT(*) AS n FROM "${t}" ${where}`).get().n : 0);
const summary = `${n("products")} products, ${n("collections")} collections, ${n("reviews")} reviews (${n("reviews", "WHERE json_extract(data, '$.verified') = 1")} verified)`;
db.close();
fs.renameSync(tmp, out);
console.log(`deploy/verda.db: ${summary}, ${fs.statSync(out).size} bytes`);
