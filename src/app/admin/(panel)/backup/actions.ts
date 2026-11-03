"use server";

import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { getT } from "@/lib/i18n/admin/server";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { clearDemoOrders, clearDemoReviews, exportAll, importAll } from "@/server/store";

type Snapshot = Parameters<typeof importAll>[0];
const MAX_BYTES = 60 * 1024 * 1024;

type T = Awaited<ReturnType<typeof getT>>["t"];

function validate(raw: unknown, t: T): Snapshot {
  if (!raw || typeof raw !== "object") throw new Error(t("overview.backup.errors.notObject"));
  const d = raw as Record<string, unknown>;
  for (const k of ["products", "collections", "reviews", "orders"]) if (!Array.isArray(d[k])) throw new Error(t("overview.backup.errors.missingList", { key: k }));
  for (const k of ["settings", "content"]) if (!d[k] || typeof d[k] !== "object") throw new Error(t("overview.backup.errors.missingKey", { key: k }));
  const products = d.products as { id?: unknown; handle?: unknown }[];
  if (products.some((p) => typeof p?.id !== "string" || typeof p?.handle !== "string")) throw new Error(t("overview.backup.errors.productIds"));
  if (new Set(products.map((p) => p.handle)).size !== products.length) throw new Error(t("overview.backup.errors.dupHandle"));
  if (new Set(products.map((p) => p.id)).size !== products.length) throw new Error(t("overview.backup.errors.dupId"));
  const collections = d.collections as { handle?: unknown }[];
  if (collections.some((c) => typeof c?.handle !== "string")) throw new Error(t("overview.backup.errors.collectionHandle"));
  if (new Set(collections.map((c) => c.handle)).size !== collections.length) throw new Error(t("overview.backup.errors.dupCollection"));
  const reviews = d.reviews as { id?: unknown; productId?: unknown; status?: unknown; date?: unknown }[];
  if (reviews.some((r) => typeof r?.id !== "string" || typeof r?.productId !== "string" || !["published", "hidden", "pending"].includes(r?.status as string) || typeof r?.date !== "string"))
    throw new Error(t("overview.backup.errors.reviews"));
  if (Array.isArray(d.settings) || Array.isArray(d.content)) throw new Error(t("overview.backup.errors.objects"));
  const orders = d.orders as { id?: unknown; number?: unknown; customer?: { phone?: unknown }; totals?: unknown }[];
  if (orders.some((o) => typeof o?.id !== "string" || typeof o?.number !== "string" || typeof o?.customer?.phone !== "string" || !o?.totals)) throw new Error(t("overview.backup.errors.orders"));
  return raw as Snapshot;
}

/**
 * Restore the store from an uploaded backup. The client gzips the JSON before
 * sending (field "gzip" = "1") to stay well under the server-action body limit.
 * A safety copy of the current data is written to data/backups/ first.
 */
export async function importBackup(form: FormData): Promise<ActionResult<{ products: number; orders: number; safetyCopy: string }>> {
  await guard();
  const { t } = await getT();
  try {
    const file = form.get("file");
    if (!(file instanceof Blob) || !file.size) throw new Error(t("overview.backup.errors.noFile"));
    if (file.size > MAX_BYTES) throw new Error(t("overview.backup.errors.tooLarge"));
    let buf: Buffer = Buffer.from(await file.arrayBuffer());
    if (form.get("gzip") === "1") buf = gunzipSync(buf, { maxOutputLength: MAX_BYTES * 4 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(buf.toString("utf8"));
    } catch {
      throw new Error(t("overview.backup.errors.invalidJson"));
    }
    const data = validate(parsed, t);

    const dir = path.join(process.cwd(), "data", "backups");
    fs.mkdirSync(dir, { recursive: true });
    const safety = path.join(dir, `pre-import-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(safety, JSON.stringify(exportAll()));

    importAll(data);
    published("Imported backup", `${data.products.length} products · ${data.orders.length} orders`, `Safety copy: ${path.relative(process.cwd(), safety)}`);
    return { ok: true, data: { products: data.products.length, orders: data.orders.length, safetyCopy: path.relative(process.cwd(), safety) } };
  } catch (e) {
    return fail(e);
  }
}

export async function clearDemo(): Promise<ActionResult<{ removed: number }>> {
  await guard();
  try {
    const orders = Number(clearDemoOrders());
    const reviews = clearDemoReviews();
    const removed = orders + reviews;
    published("Cleared demo data", `${orders} orders, ${reviews} reviews`);
    return { ok: true, data: { removed } };
  } catch (e) {
    return fail(e);
  }
}
