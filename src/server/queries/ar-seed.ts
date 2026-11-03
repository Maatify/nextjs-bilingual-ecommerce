import { bump, getDb } from "@/server/store";
import { arSeedCollections } from "./ar-seed-collections";
import { arSeedContent } from "./ar-seed-content";
import { arSeedProducts } from "./ar-seed-products";

/*
 * One-time, idempotent Arabic copy for the seeded store (products, categories, pages, FAQ, homepage…).
 * Each part only fills `ar` fields that are still empty (never overwrites the merchant's translations).
 * A kv flag per part makes it run at most once per database — clearing a field later stays cleared.
 */
const FLAG = "ar_seed_v1:";
let ran = false;

export function ensureArabicSeed() {
  if (ran) return;
  ran = true;
  const db = getDb();
  const parts: [string, () => boolean][] = [
    ["products", arSeedProducts],
    ["collections", arSeedCollections],
    ["content", arSeedContent],
  ];
  let changed = false;
  for (const [name, run] of parts) {
    const key = FLAG + name;
    if (db.prepare("SELECT 1 FROM kv WHERE key = ?").get(key)) continue;
    try {
      if (!run()) continue; // part not implemented yet — don't burn the flag
      db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").run(key, new Date().toISOString());
      changed = true;
    } catch (e) {
      console.error(`[ar-seed] ${name}`, e);
    }
  }
  if (changed) bump();
}
