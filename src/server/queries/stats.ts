import fs from "node:fs";
import path from "node:path";
import {
  allOrders,
  DB_PATH,
  getContent,
  getSettings,
  listActivity,
  listCollections,
  listMedia,
  listProducts,
  listReviews,
  listSubscribers,
} from "@/server/store";
import { makeFormat, makeT, type AdminLocale } from "@/lib/i18n/admin";
import type { Order, OrderStatus } from "@/lib/types";

/*
 * Read-only reporting for the admin Overview / Analytics / Backup pages.
 * All dates are bucketed in the store's local time zone (Cairo) so "today"
 * matches what the merchant sees on the wall clock.
 */

/** Draft orders (admin "Create order" drafts) never count towards stats or revenue. */
const realOrders = () => allOrders().filter((o) => o.status !== "draft");

const TZ = "Africa/Cairo";
const DAY = 864e5;

export type RangeKey = "today" | "7d" | "30d" | "90d";
export const RANGES: RangeKey[] = ["today", "7d", "30d", "90d"];
export const parseRange = (v: unknown, fallback: RangeKey = "30d"): RangeKey => (RANGES.includes(v as RangeKey) ? (v as RangeKey) : fallback);
const RANGE_DAYS: Record<RangeKey, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

const partsFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" });
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function local(d: Date | string) {
  const p = Object.fromEntries(partsFmt.formatToParts(typeof d === "string" ? new Date(d) : d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, wd: WD.indexOf(p.weekday) };
}

/** Day keys (YYYY-MM-DD, local) for the `n` days ending `offset` days before today, oldest first. */
function dayKeys(n: number, offset = 0, now = Date.now()) {
  const out: string[] = [];
  for (let i = n - 1 + offset; i >= offset; i--) out.push(local(new Date(now - i * DAY)).day);
  return [...new Set(out)];
}

/** "12 Mar" / "12 مارس" for a YYYY-MM-DD key (noon UTC is the same calendar day in Cairo). */
const dayLabel = (key: string, locale: AdminLocale = "en") => makeFormat(locale).date(`${key}T12:00:00Z`, { day: "numeric", month: "short" });

/* ───────────────────────── order helpers ───────────────────────── */

const isCounted = (o: Order) => o.status !== "cancelled";
/** Net revenue: cancelled and returned (refunded) orders don't count. */
const revenueOf = (o: Order) => (o.status === "cancelled" || o.status === "returned" ? 0 : o.totals.total);
const unitsOf = (o: Order) => o.lines.reduce((s, l) => s + l.qty, 0);

/** phone → ISO time of that customer's first ever (non-cancelled) order */
function firstOrderIndex(orders: Order[]) {
  const first = new Map<string, string>();
  for (const o of orders) {
    if (!isCounted(o)) continue;
    const cur = first.get(o.customer.phone);
    if (!cur || o.createdAt < cur) first.set(o.customer.phone, o.createdAt);
  }
  return first;
}

interface Agg {
  revenue: number;
  orders: number;
  units: number;
  returning: number;
  cod: number;
}
const emptyAgg = (): Agg => ({ revenue: 0, orders: 0, units: 0, returning: 0, cod: 0 });
function addTo(a: Agg, o: Order, first: Map<string, string>) {
  if (!isCounted(o)) return;
  a.revenue += revenueOf(o);
  a.orders += 1;
  a.units += unitsOf(o);
  if ((first.get(o.customer.phone) ?? o.createdAt) < o.createdAt) a.returning += 1;
  if (o.paymentMethod === "cod") a.cod += 1;
}
const metrics = (a: Agg) => ({
  revenue: a.revenue,
  orders: a.orders,
  aov: a.orders ? a.revenue / a.orders : 0,
  ipo: a.orders ? a.units / a.orders : 0,
  returningRate: a.orders ? (a.returning / a.orders) * 100 : 0,
  codShare: a.orders ? (a.cod / a.orders) * 100 : 0,
});
type MetricKey = keyof ReturnType<typeof metrics>;
const delta = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null);

/** Split orders into the current and previous period of a range, plus chart buckets. */
function windowed(orders: Order[], range: RangeKey, now = Date.now(), locale: AdminLocale = "en") {
  const today = local(new Date(now)).day;
  if (range === "today") {
    const yesterday = local(new Date(now - DAY)).day;
    const cutoff = new Date(now - DAY).toISOString();
    const hourNow = local(new Date(now)).hour;
    const cur = orders.filter((o) => local(o.createdAt).day === today);
    const prev = orders.filter((o) => local(o.createdAt).day === yesterday && o.createdAt <= cutoff);
    const prevFull = orders.filter((o) => local(o.createdAt).day === yesterday);
    const buckets = Array.from({ length: hourNow + 1 }, (_, h) => ({ key: String(h), label: `${String(h).padStart(2, "0")}:00` }));
    const bucketOf = (o: Order) => String(local(o.createdAt).hour);
    return { cur, prev, prevForChart: prevFull, buckets, prevBucketOf: bucketOf, bucketOf, unit: "hour" as const };
  }
  const n = RANGE_DAYS[range];
  const curKeys = dayKeys(n, 0, now);
  const prevKeys = dayKeys(n, n, now);
  const curSet = new Set(curKeys);
  const prevSet = new Set(prevKeys);
  const cur = orders.filter((o) => curSet.has(local(o.createdAt).day));
  const prev = orders.filter((o) => prevSet.has(local(o.createdAt).day));
  const buckets = curKeys.map((k) => ({ key: k, label: dayLabel(k, locale) }));
  // previous period aligned by position: day i of prev ↔ day i of current
  const prevMap = new Map(prevKeys.map((k, i) => [k, curKeys[i] ?? k]));
  return { cur, prev, prevForChart: prev, buckets, bucketOf: (o: Order) => local(o.createdAt).day, prevBucketOf: (o: Order) => prevMap.get(local(o.createdAt).day) ?? "", unit: "day" as const };
}

/* ───────────────────────── Overview ───────────────────────── */

export interface SeriesPoint {
  key: string;
  label: string;
  revenue: number;
  orders: number;
  prevRevenue: number;
  prevOrders: number;
}

export interface Kpi {
  key: MetricKey;
  value: number;
  prev: number;
  delta: number | null;
  spark: number[];
}

export interface AttentionItem {
  key: string;
  label: string;
  detail: string;
  count: number;
  href: string;
  tone: "amber" | "red" | "violet" | "blue";
  icon: "orders" | "inventory" | "reviews" | "discount";
}

/** `locale` only affects labels (chart axis, needs-attention copy). */
export function overviewStats(range: RangeKey, locale: AdminLocale = "en") {
  const t = makeT(locale);
  const f = makeFormat(locale);
  const orders = realOrders();
  const products = listProducts();
  const reviews = listReviews();
  const settings = getSettings();
  const first = firstOrderIndex(orders);
  const w = windowed(orders, range, Date.now(), locale);

  const curAgg = emptyAgg();
  const prevAgg = emptyAgg();
  w.cur.forEach((o) => addTo(curAgg, o, first));
  w.prev.forEach((o) => addTo(prevAgg, o, first));
  const cur = metrics(curAgg);
  const prev = metrics(prevAgg);

  const perBucket = new Map(w.buckets.map((b) => [b.key, emptyAgg()]));
  w.cur.forEach((o) => {
    const a = perBucket.get(w.bucketOf(o));
    if (a) addTo(a, o, first);
  });
  const prevBucket = new Map(w.buckets.map((b) => [b.key, emptyAgg()]));
  w.prevForChart.forEach((o) => {
    const a = prevBucket.get(w.prevBucketOf(o));
    if (a) addTo(a, o, first);
  });
  const bucketMetrics = w.buckets.map((b) => metrics(perBucket.get(b.key)!));

  const series: SeriesPoint[] = w.buckets.map((b, i) => {
    const p = prevBucket.get(b.key)!;
    return { key: b.key, label: b.label, revenue: bucketMetrics[i].revenue, orders: bucketMetrics[i].orders, prevRevenue: p.revenue, prevOrders: p.orders };
  });

  const keys: MetricKey[] = ["revenue", "orders", "aov", "ipo", "returningRate", "codShare"];
  const kpis: Kpi[] = keys.map((k) => ({ key: k, value: cur[k], prev: prev[k], delta: delta(cur[k], prev[k]), spark: bucketMetrics.map((m) => m[k]) }));

  // needs attention
  const pending = orders.filter((o) => o.status === "pending");
  const oldestPending = pending.reduce<string | null>((m, o) => (!m || o.createdAt < m ? o.createdAt : m), null);
  const lowVariants = products.filter((p) => p.status !== "archived").flatMap((p) => p.sizes.filter((s) => s.stock <= 3).map((s) => ({ p, s })));
  const outOfStock = lowVariants.filter((x) => x.s.stock === 0).length;
  const pendingReviews = reviews.filter((r) => r.status === "pending").length;
  const nearLimit = settings.promoCodes.filter((c) => c.active && c.usageLimit && (c.used ?? 0) / c.usageLimit >= 0.8);
  const attention: AttentionItem[] = [
    { key: "pending", label: t("overview.attention.pending"), detail: oldestPending ? t("overview.attention.pendingSince", { date: f.dateTime(oldestPending) }) : t("overview.attention.allCaughtUp"), count: pending.length, href: "/admin/orders?status=pending", tone: "amber" as const, icon: "orders" as const },
    { key: "stock", label: t("overview.attention.stock"), detail: lowVariants.length ? t("overview.attention.stockDetail", { soldOut: outOfStock, products: new Set(lowVariants.map((x) => x.p.id)).size }) : t("overview.attention.stockHealthy"), count: lowVariants.length, href: "/admin/inventory", tone: outOfStock ? ("red" as const) : ("amber" as const), icon: "inventory" as const },
    { key: "reviews", label: t("overview.attention.reviews"), detail: pendingReviews ? t("overview.attention.reviewsDetail") : t("overview.attention.reviewsNone"), count: pendingReviews, href: "/admin/reviews", tone: "violet" as const, icon: "reviews" as const },
    { key: "codes", label: t("overview.attention.codes"), detail: nearLimit.length ? nearLimit.map((c) => `${c.code} ${c.used ?? 0}/${c.usageLimit}`).join(" · ") : t("overview.attention.codesNone"), count: nearLimit.length, href: "/admin/discounts", tone: "blue" as const, icon: "discount" as const },
  ];

  // top products & governorates (current period)
  const byProduct = new Map<string, { units: number; revenue: number }>();
  const byGov = new Map<string, { orders: number; revenue: number }>();
  for (const o of w.cur) {
    if (!isCounted(o)) continue;
    const net = revenueOf(o);
    const gross = o.lines.reduce((s, l) => s + l.unit * l.qty, 0) || 1;
    for (const l of o.lines) {
      const e = byProduct.get(l.productId) ?? { units: 0, revenue: 0 };
      e.units += l.qty;
      e.revenue += (net * (l.unit * l.qty)) / gross; // allocate net revenue by line value
      byProduct.set(l.productId, e);
    }
    const g = byGov.get(o.address.governorate) ?? { orders: 0, revenue: 0 };
    g.orders += 1;
    g.revenue += net;
    byGov.set(o.address.governorate, g);
  }
  const pIndex = new Map(products.map((p) => [p.id, p]));
  const topProducts = [...byProduct.entries()]
    .map(([id, v]) => {
      const p = pIndex.get(id);
      const line = w.cur.flatMap((o) => o.lines).find((l) => l.productId === id);
      return { id, title: p?.title ?? line?.title ?? id, image: p?.colors[0]?.images[0] ?? line?.image ?? "", units: v.units, revenue: Math.round(v.revenue) };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const governorates = [...byGov.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.orders - a.orders);

  const recentOrders = orders.slice(0, 8).map((o) => ({ id: o.id, number: o.number, name: o.customer.name, status: o.status, total: o.totals.total, createdAt: o.createdAt, items: unitsOf(o), demo: !!o.demo }));
  const activity = listActivity(8);

  // store health line
  const todayKey = local(new Date()).day;
  const todayOrders = orders.filter((o) => isCounted(o) && local(o.createdAt).day === todayKey);
  const health = {
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.reduce((s, o) => s + revenueOf(o), 0),
    pending: pending.length,
    lowStock: lowVariants.length,
    activeProducts: products.filter((p) => (p.status ?? "active") === "active").length,
    storeName: settings.site.name,
  };

  return { range, unit: w.unit, kpis, series, attention, topProducts, governorates, recentOrders, activity, health, demoCount: orders.filter((o) => o.demo).length };
}
export type OverviewData = ReturnType<typeof overviewStats>;

/* ───────────────────────── Analytics ───────────────────────── */

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";
export const ANALYTICS_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "all"];
export const parseAnalyticsRange = (v: unknown): AnalyticsRange => (ANALYTICS_RANGES.includes(v as AnalyticsRange) ? (v as AnalyticsRange) : "30d");

const FUNNEL: { key: "placed" | "confirmed" | "packed" | "shipped" | "delivered" | "kept"; reached: OrderStatus[] }[] = [
  { key: "placed", reached: ["pending", "confirmed", "packed", "shipped", "delivered", "returned", "cancelled"] },
  { key: "confirmed", reached: ["confirmed", "packed", "shipped", "delivered", "returned"] },
  { key: "packed", reached: ["packed", "shipped", "delivered", "returned"] },
  { key: "shipped", reached: ["shipped", "delivered", "returned"] },
  { key: "delivered", reached: ["delivered", "returned"] },
  { key: "kept", reached: ["delivered"] },
];

export function analyticsStats(range: AnalyticsRange, locale: AdminLocale = "en") {
  const t = makeT(locale);
  const all = realOrders();
  const first = firstOrderIndex(all);
  const now = Date.now();
  let keys: string[];
  if (range === "all") {
    const oldest = all.length ? new Date(all[all.length - 1].createdAt).getTime() : now;
    keys = dayKeys(Math.max(1, Math.ceil((now - oldest) / DAY) + 1), 0, now);
  } else keys = dayKeys(RANGE_DAYS[range], 0, now);
  const keySet = new Set(keys);
  const orders = all.filter((o) => keySet.has(local(o.createdAt).day));
  const counted = orders.filter(isCounted);

  // daily + weekly series
  const daily = new Map(keys.map((k) => [k, { revenue: 0, orders: 0 }]));
  for (const o of counted) {
    const d = daily.get(local(o.createdAt).day);
    if (d) { d.revenue += revenueOf(o); d.orders += 1; }
  }
  const days = keys.map((k) => ({ key: k, label: dayLabel(k, locale), ...daily.get(k)! }));
  const weeks: typeof days = [];
  for (let i = days.length; i > 0; i -= 7) {
    const chunk = days.slice(Math.max(0, i - 7), i);
    weeks.unshift({ key: chunk[0].key, label: t("overview.analytics.weekOf", { date: chunk[0].label }), revenue: chunk.reduce((s, d) => s + d.revenue, 0), orders: chunk.reduce((s, d) => s + d.orders, 0) });
  }

  // funnel + status counts
  const funnel = FUNNEL.map((f) => ({ key: f.key, label: t(`overview.analytics.funnel.${f.key}`), value: orders.filter((o) => f.reached.includes(o.status)).length }));
  const statusCounts = (["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"] as OrderStatus[]).map((s) => ({ status: s, value: orders.filter((o) => o.status === s).length }));

  const mix = <K extends string>(get: (o: Order) => K) => {
    const m = new Map<K, { orders: number; revenue: number }>();
    for (const o of counted) {
      const e = m.get(get(o)) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += revenueOf(o);
      m.set(get(o), e);
    }
    return [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.orders - a.orders);
  };
  const payments = mix((o) => o.paymentMethod);
  const sources = mix((o) => o.source);

  // Buy-2-Get-1
  const bogoOrders = counted.filter((o) => o.lines.some((l) => l.free > 0) || o.totals.bogoDiscount > 0);
  const bogo = {
    orders: bogoOrders.length,
    share: counted.length ? (bogoOrders.length / counted.length) * 100 : 0,
    discount: bogoOrders.reduce((s, o) => s + o.totals.bogoDiscount, 0),
    freeUnits: bogoOrders.reduce((s, o) => s + o.lines.reduce((n, l) => n + l.free, 0), 0),
    aovWith: bogoOrders.length ? bogoOrders.reduce((s, o) => s + revenueOf(o), 0) / bogoOrders.length : 0,
    aovWithout: counted.length - bogoOrders.length ? counted.filter((o) => !bogoOrders.includes(o)).reduce((s, o) => s + revenueOf(o), 0) / (counted.length - bogoOrders.length) : 0,
    unitsWith: bogoOrders.length ? bogoOrders.reduce((s, o) => s + unitsOf(o), 0) / bogoOrders.length : 0,
  };

  // Multi-buy % (e.g. 2 pieces → 20% off)
  const multiOrders = counted.filter((o) => (o.totals.multiDiscount ?? 0) > 0);
  const multi = {
    orders: multiOrders.length,
    share: counted.length ? (multiOrders.length / counted.length) * 100 : 0,
    discount: multiOrders.reduce((s, o) => s + (o.totals.multiDiscount ?? 0), 0),
  };

  // AOV distribution
  const totals = counted.filter((o) => o.status !== "returned").map((o) => o.totals.total);
  const maxT = Math.max(0, ...totals);
  const step = maxT > 8000 ? 1000 : maxT > 4000 ? 500 : 250;
  const binCount = Math.max(1, Math.min(14, Math.ceil((maxT + 1) / step)));
  const histogram = Array.from({ length: binCount }, (_, i) => ({ from: i * step, to: (i + 1) * step, value: 0 }));
  for (const t of totals) histogram[Math.min(binCount - 1, Math.floor(t / step))].value++;
  const sorted = [...totals].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  // hour-of-day heatmap (Mon..Sun × 0..23)
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const o of counted) {
    const p = local(o.createdAt);
    if (p.wd >= 0) heat[p.wd][p.hour]++;
  }

  // colours & sizes
  const colours = new Map<string, number>();
  const sizes = new Map<string, number>();
  const hexOf = new Map<string, string>();
  for (const p of listProducts()) for (const c of p.colors) if (!hexOf.has(c.name)) hexOf.set(c.name, c.hex);
  for (const o of counted)
    for (const l of o.lines) {
      colours.set(l.color, (colours.get(l.color) ?? 0) + l.qty);
      sizes.set(l.size, (sizes.get(l.size) ?? 0) + l.qty);
    }
  const topColours = [...colours.entries()].map(([name, units]) => ({ name, units, hex: hexOf.get(name) ?? "#888" })).sort((a, b) => b.units - a.units).slice(0, 8);
  const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"];
  const sizeRank = (s: string) => (SIZE_ORDER.indexOf(s) >= 0 ? SIZE_ORDER.indexOf(s) : 50 + (Number(s) || 0));
  const topSizes = [...sizes.entries()].map(([name, units]) => ({ name, units })).sort((a, b) => sizeRank(a.name) - sizeRank(b.name));

  // repeat customers
  const perCustomer = new Map<string, { orders: number; revenue: number; name: string }>();
  for (const o of counted) {
    const e = perCustomer.get(o.customer.phone) ?? { orders: 0, revenue: 0, name: o.customer.name };
    e.orders += 1;
    e.revenue += revenueOf(o);
    perCustomer.set(o.customer.phone, e);
  }
  const custs = [...perCustomer.values()];
  const newCustomers = [...perCustomer.keys()].filter((ph) => keySet.has(local(first.get(ph) ?? "").day)).length;
  const cohort = {
    customers: custs.length,
    newCustomers,
    returningCustomers: custs.length - newCustomers,
    repeatRate: custs.length ? (custs.filter((c) => c.orders > 1).length / custs.length) * 100 : 0,
    avgOrders: custs.length ? counted.length / custs.length : 0,
    ltv: custs.length ? custs.reduce((s, c) => s + c.revenue, 0) / custs.length : 0,
    buckets: [
      { label: t("overview.analytics.bucket.1"), value: custs.filter((c) => c.orders === 1).length },
      { label: t("overview.analytics.bucket.2"), value: custs.filter((c) => c.orders === 2).length },
      { label: t("overview.analytics.bucket.3"), value: custs.filter((c) => c.orders === 3).length },
      { label: t("overview.analytics.bucket.4+"), value: custs.filter((c) => c.orders >= 4).length },
    ],
    repeatRevenueShare: (() => {
      const total = custs.reduce((s, c) => s + c.revenue, 0);
      return total ? (custs.filter((c) => c.orders > 1).reduce((s, c) => s + c.revenue, 0) / total) * 100 : 0;
    })(),
  };

  // promo codes
  const settings = getSettings();
  const promo = new Map<string, { orders: number; discount: number; revenue: number }>();
  for (const o of counted) {
    if (!o.promoCode) continue;
    const e = promo.get(o.promoCode) ?? { orders: 0, discount: 0, revenue: 0 };
    e.orders += 1;
    e.discount += o.totals.promoDiscount;
    e.revenue += revenueOf(o);
    promo.set(o.promoCode, e);
  }
  const codes = [...new Set([...settings.promoCodes.map((c) => c.code), ...promo.keys()])].map((code) => {
    const def = settings.promoCodes.find((c) => c.code === code);
    const u = promo.get(code) ?? { orders: 0, discount: 0, revenue: 0 };
    return { code, label: def?.label ?? t("overview.analytics.notInSettings"), active: def?.active ?? false, used: def?.used ?? 0, usageLimit: def?.usageLimit ?? null, ...u };
  }).sort((a, b) => b.orders - a.orders);

  const revenue = counted.reduce((s, o) => s + revenueOf(o), 0);
  return {
    range,
    summary: { revenue, orders: counted.length, aov: counted.length ? revenue / counted.length : 0, cancelled: orders.length - counted.length, units: counted.reduce((s, o) => s + unitsOf(o), 0) },
    days,
    weeks,
    funnel,
    statusCounts,
    payments,
    sources,
    bogo,
    multi,
    histogram,
    median,
    heat,
    topColours,
    topSizes,
    cohort,
    codes,
    promoOrderShare: counted.length ? (counted.filter((o) => o.promoCode).length / counted.length) * 100 : 0,
  };
}
export type AnalyticsData = ReturnType<typeof analyticsStats>;

/* ───────────────────────── Backup / DB info ───────────────────────── */

export function dbInfo(locale: AdminLocale = "en") {
  const t = makeT(locale);
  const orders = realOrders();
  const reviews = listReviews();
  const products = listProducts();
  const content = getContent();
  const settings = getSettings();
  const file = DB_PATH;
  let size = 0;
  for (const f of [file, `${file}-wal`]) {
    try {
      size += fs.statSync(/* turbopackIgnore: true */ f).size;
    } catch {
      /* not present */
    }
  }
  return {
    file: path.relative(process.cwd(), file) || file,
    size,
    tables: [
      { key: "products", label: t("overview.backup.tables.products"), count: products.length, detail: t("overview.backup.activeN", { count: products.filter((p) => (p.status ?? "active") === "active").length }) },
      { key: "collections", label: t("overview.backup.tables.collections"), count: listCollections().length },
      { key: "orders", label: t("overview.backup.tables.orders"), count: orders.length, detail: t("overview.backup.demoN", { count: orders.filter((o) => o.demo).length }) },
      { key: "reviews", label: t("overview.backup.tables.reviews"), count: reviews.length, detail: t("overview.backup.pendingN", { count: reviews.filter((r) => r.status === "pending").length }) },
      { key: "media", label: t("overview.backup.tables.media"), count: listMedia().length },
      { key: "subscribers", label: t("overview.backup.tables.subscribers"), count: listSubscribers().length },
      { key: "activity", label: t("overview.backup.tables.activity"), count: listActivity(1_000_000).length },
      { key: "pages", label: t("overview.backup.tables.pages"), count: content.pages.length },
      { key: "codes", label: t("overview.backup.tables.codes"), count: settings.promoCodes.length },
    ] as { key: string; label: string; count: number; detail?: string }[],
    demoOrders: orders.filter((o) => o.demo).length,
  };
}
export type DbInfo = ReturnType<typeof dbInfo>;
