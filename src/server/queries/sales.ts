import type { Order, OrderLine, OrderStatus } from "@/lib/types";
import { allOrders, getDb, incrementStock, listOrders, type OrderQuery } from "@/server/store";

/*
 * Sales queries for the admin (orders, customers). Server-only: import from
 * server components, route handlers and server actions.
 */

export const ORDER_PAGE_SIZE = 25;
const STATUSES: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"];

/** Revenue-counting orders (not cancelled / returned). */
export const counts = (o: Order) => o.status !== "cancelled" && o.status !== "returned";
export const normPhone = (p: string) => p.replace(/\D/g, "");

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Day "YYYY-MM-DD" → ISO at local midnight (to is exclusive, so +1 day). */
function dayIso(day: string, addDays = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + addDays);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export interface OrderFilters {
  status: OrderStatus | "all";
  q: string;
  from: string;
  to: string;
  page: number;
}

export function parseOrderFilters(sp: Params | URLSearchParams): OrderFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? "" : one(sp[k]));
  const status = get("status") as OrderStatus;
  return {
    status: STATUSES.includes(status) ? status : "all",
    q: get("q").trim().slice(0, 80),
    from: get("from"),
    to: get("to"),
    page: Math.max(1, Number.parseInt(get("page"), 10) || 1),
  };
}

function baseQuery(f: OrderFilters): OrderQuery {
  return { q: f.q || undefined, from: f.from ? dayIso(f.from) : undefined, to: f.to ? dayIso(f.to, 1) : undefined };
}

/** Like listOrders(), but "all" never includes drafts (they live on their own Drafts page). */
function listPlaced(query: OrderQuery): { rows: Order[]; total: number } {
  if (query.status && query.status !== "all") return listOrders(query);
  const where = ["status != 'draft'"];
  const args: (string | number)[] = [];
  if (query.from) (where.push("created_at >= ?"), args.push(query.from));
  if (query.to) (where.push("created_at < ?"), args.push(query.to));
  if (query.q) {
    where.push("(number LIKE ? OR phone LIKE ? OR data LIKE ?)");
    const like = `%${query.q}%`;
    args.push(like, like, like);
  }
  const w = `WHERE ${where.join(" AND ")}`;
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM orders ${w}`).get(...args) as { n: number }).n;
  const rows = (db.prepare(`SELECT data FROM orders ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, query.limit ?? 50, query.offset ?? 0) as { data: string }[]).map((r) => JSON.parse(r.data) as Order);
  return { rows, total };
}

/** Every placed (non-draft) order, newest first. */
export const placedOrders = () => allOrders().filter((o) => o.status !== "draft");

export function ordersPage(f: OrderFilters) {
  const q = baseQuery(f);
  const { rows, total } = listPlaced({ ...q, status: f.status, limit: ORDER_PAGE_SIZE, offset: (f.page - 1) * ORDER_PAGE_SIZE });
  const tabCounts = Object.fromEntries([["all", listPlaced({ ...q, limit: 1 }).total], ...STATUSES.map((s) => [s, listOrders({ ...q, status: s, limit: 1 }).total])]) as Record<OrderStatus | "all", number>;
  return { rows, total, tabCounts, pages: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)) };
}

/** Every order matching the filter (no pagination) — used for CSV export. */
export function ordersForExport(f: OrderFilters, ids?: string[]) {
  if (ids?.length) {
    const set = new Set(ids);
    return placedOrders().filter((o) => set.has(o.id));
  }
  return listPlaced({ ...baseQuery(f), status: f.status, limit: 100_000 }).rows;
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  // neutralise spreadsheet formula injection (customer-typed text: names, addresses, notes); numbers stay numbers
  const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function ordersCsv(orders: Order[]) {
  const head = ["Number", "Date", "Status", "Payment status", "Payment method", "Source", "Customer", "Phone", "Email", "Governorate", "City", "Street", "Building", "Landmark", "Delivery", "Items", "Lines", "Subtotal", "Offer discount", "Multi-buy discount", "Promo discount", "Prepaid discount", "Shipping", "Protection", "Total", "Promo code", "Tags", "Demo"];
  const rows = orders.map((o) => [
    o.number,
    o.createdAt,
    o.status,
    o.paymentStatus,
    o.paymentMethod,
    o.source,
    o.customer.name,
    o.customer.phone,
    o.customer.email ?? "",
    o.address.governorate,
    o.address.city,
    o.address.street,
    o.address.building,
    o.address.landmark ?? "",
    o.shipping,
    o.totals.itemCount,
    o.lines.map((l) => `${l.qty}x ${l.title} (${l.color}/${l.size})${l.free ? " FREE" : ""}`).join("; "),
    o.totals.subtotal,
    o.totals.bogoDiscount,
    o.totals.multiDiscount ?? 0,
    o.totals.promoDiscount,
    o.totals.prepaidDiscount,
    o.totals.shipping,
    o.totals.protection,
    o.totals.total,
    o.promoCode ?? "",
    (o.tags ?? []).join(" "),
    o.demo ? "yes" : "",
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Put stock back for a cancelled / returned order. */
export function restoreStock(lines: OrderLine[]) {
  // per variant (colour × size) — the order line carries the colour it was sold in
  incrementStock(lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })));
}

/* ───────────────────────── customers ───────────────────────── */

export interface CustomerRow {
  phone: string;
  name: string;
  email?: string;
  governorate: string;
  city: string;
  orders: number;
  /** all orders incl. cancelled / returned */
  allOrders: number;
  spent: number;
  aov: number;
  firstAt: string;
  lastAt: string;
  demo: boolean;
}

function aggregate(orders: Order[]): Map<string, { row: CustomerRow; orders: Order[] }> {
  const map = new Map<string, { row: CustomerRow; orders: Order[] }>();
  // allOrders() is newest first → first seen = latest details
  for (const o of orders) {
    const key = normPhone(o.customer.phone);
    if (!key) continue;
    let e = map.get(key);
    if (!e) {
      e = {
        row: { phone: key, name: o.customer.name, email: o.customer.email, governorate: o.address.governorate, city: o.address.city, orders: 0, allOrders: 0, spent: 0, aov: 0, firstAt: o.createdAt, lastAt: o.createdAt, demo: !!o.demo },
        orders: [],
      };
      map.set(key, e);
    }
    e.orders.push(o);
    e.row.allOrders++;
    if (!e.row.email && o.customer.email) e.row.email = o.customer.email;
    if (o.createdAt < e.row.firstAt) e.row.firstAt = o.createdAt;
    if (o.createdAt > e.row.lastAt) e.row.lastAt = o.createdAt;
    if (!o.demo) e.row.demo = false;
    if (counts(o)) {
      e.row.orders++;
      e.row.spent += o.totals.total;
    }
  }
  for (const { row } of map.values()) row.aov = row.orders ? Math.round(row.spent / row.orders) : 0;
  return map;
}

export function listCustomers(): CustomerRow[] {
  return [...aggregate(placedOrders()).values()].map((e) => e.row).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function customerOrderCount(phone: string) {
  const key = normPhone(phone);
  return placedOrders().filter((o) => normPhone(o.customer.phone) === key).length;
}

export interface CustomerDetail {
  row: CustomerRow;
  orders: Order[];
  address: Order["address"];
  sizes: { label: string; n: number }[];
  colors: { label: string; n: number }[];
  products: { title: string; image: string; n: number }[];
  /** cumulative spend after each counted order (chronological) */
  lifetime: number[];
  /** `month` = "YYYY-MM-15" so the client can format the label in the admin locale */
  monthly: { label: string; month: string; value: number }[];
}

export function getCustomerDetail(phone: string): CustomerDetail | null {
  const key = normPhone(phone);
  const all = placedOrders().filter((o) => normPhone(o.customer.phone) === key);
  if (!all.length) return null;
  const e = aggregate(all).get(key)!;
  const tally = (pick: (l: OrderLine) => string) => {
    const m = new Map<string, number>();
    for (const o of all) for (const l of o.lines) m.set(pick(l), (m.get(pick(l)) ?? 0) + l.qty);
    return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  };
  const prod = new Map<string, { title: string; image: string; n: number }>();
  for (const o of all) for (const l of o.lines) {
    const p = prod.get(l.productId) ?? { title: l.title, image: l.image, n: 0 };
    p.n += l.qty;
    prod.set(l.productId, p);
  }
  const chrono = [...all].filter(counts).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let run = 0;
  const lifetime = [0, ...chrono.map((o) => (run += o.totals.total))];
  const months: { label: string; month: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), month: `${k}-15`, value: chrono.filter((o) => o.createdAt.startsWith(k)).reduce((s, o) => s + o.totals.total, 0) });
  }
  return {
    row: e.row,
    orders: all,
    address: all[0].address,
    sizes: tally((l) => l.size).slice(0, 5),
    colors: tally((l) => l.color).slice(0, 5),
    products: [...prod.values()].sort((a, b) => b.n - a.n).slice(0, 4),
    lifetime,
    monthly: months,
  };
}

/** Request-time clock for server pages (segments / "days since" are computed against it). */
export const requestNow = () => Date.now();
