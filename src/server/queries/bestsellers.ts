import { allOrders, listProducts } from "@/server/store";

/** One ranked best seller, already resolved to the colour that sells best (plain data — safe to pass to client components). */
export interface Bestseller {
  rank: number;
  productId: string;
  handle: string;
  title: string;
  price: number;
  compareAt?: number;
  units: number;
  color: string;
  image: string;
}

const COUNTED = new Set(["pending", "confirmed", "packed", "shipped", "delivered"]);
const MIN_PRODUCTS = 3;

function rank(sinceMs: number | null) {
  const units = new Map<string, { total: number; byColor: Map<string, number> }>();
  for (const o of allOrders()) {
    if (!COUNTED.has(o.status) || o.demo) continue;
    if (sinceMs !== null && new Date(o.createdAt).getTime() < sinceMs) continue;
    for (const l of o.lines) {
      const e = units.get(l.productId) ?? { total: 0, byColor: new Map() };
      e.total += l.qty;
      e.byColor.set(l.color, (e.byColor.get(l.color) ?? 0) + l.qty);
      units.set(l.productId, e);
    }
  }
  return units;
}

/**
 * Top 3 products by REAL units sold (non-cancelled/returned orders): last 30 days, falling back to all-time.
 * Only currently active products. Returns `null` when there isn't enough real sales data to claim a
 * ranking (callers then show the hand-picked hero images with no "best seller" wording).
 */
export function getBestsellers(limit = 3): { items: Bestseller[]; period: "month" | "all" } | null {
  const products = new Map(listProducts().filter((p) => (p.status ?? "active") === "active").map((p) => [p.id, p]));
  const build = (units: ReturnType<typeof rank>) =>
    [...units.entries()]
      .filter(([id, u]) => products.has(id) && u.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, limit)
      .map(([id, u], i): Bestseller | null => {
        const p = products.get(id)!;
        const colours = [...u.byColor.entries()].sort((a, b) => b[1] - a[1]);
        const c = colours.map(([name]) => p.colors.find((x) => x.name === name)).find((x) => x?.images[0]) ?? p.colors.find((x) => x.images[0]);
        if (!c) return null;
        return { rank: i + 1, productId: p.id, handle: p.handle, title: p.title, price: p.price, compareAt: p.compareAt, units: u.total, color: c.name, image: c.images[0] };
      })
      .filter((x): x is Bestseller => x !== null)
      .map((x, i) => ({ ...x, rank: i + 1 }));

  const month = build(rank(Date.now() - 30 * 864e5));
  if (month.length >= Math.min(limit, MIN_PRODUCTS)) return { items: month, period: "month" };
  const all = build(rank(null));
  if (all.length >= Math.min(limit, MIN_PRODUCTS)) return { items: all, period: "all" };
  return null;
}
