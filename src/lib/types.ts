export type Gender = "women" | "men" | "unisex";
export type SizeChartKind = "tops" | "bottoms" | "dresses" | "onesize";
export type FitTendency = "small" | "true" | "large";

export interface ColorVariant {
  name: string;
  hex: string;
  images: string[];
}

export interface SizeStock {
  label: string;
  /** Derived: total stock of this size across every colour (kept in sync with `variants`). */
  stock: number;
}

/** One sellable combination (Shopify-style variant): colour × size, with its own stock and optional overrides. */
export interface ProductVariant {
  id: string;
  color: string;
  size: string;
  stock: number;
  /** Overrides the product price for this variant */
  price?: number;
  /** Overrides the product compare-at price for this variant */
  compareAt?: number;
  sku?: string;
  barcode?: string;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  gender: Gender;
  collections: string[];
  price: number;
  compareAt?: number;
  colors: ColorVariant[];
  sizes: SizeStock[];
  /** Stock (and optional price/SKU overrides) per colour × size. `sizes[].stock` is derived from these. */
  variants?: ProductVariant[];
  /** false = don't track stock (always purchasable). Default true. */
  trackQuantity?: boolean;
  /** Shipping weight in grams */
  weight?: number;
  /** Product-level barcode (GTIN/EAN) */
  barcode?: string;
  badge?: "Bestseller" | "New" | "Limited" | "Online exclusive";
  rating: number;
  reviewCount: number;
  fit: FitTendency;
  /** Share of reviewers who said small / true / large — sums to 100 */
  fitSplit: [number, number, number];
  /** how many published reviews said how it fits (computed; 0 → fitSplit is the merchant's pre-review estimate) */
  fitReviews?: number;
  sizeChart: SizeChartKind;
  material: string;
  gsm?: number;
  care: string[];
  highlights: string[];
  modelInfo?: string;
  /** Pieces sold in last 24h — used for honest social proof */
  sold24h: number;
  /** Only "active" products are visible on the storefront */
  status?: ProductStatus;
  seoTitle?: string;
  seoDescription?: string;
  /** Arabic overrides (fallback to English per field) */
  ar?: ProductAr;
  /** Unit cost (EGP) — admin-only, used for margin reports */
  cost?: number;
  sku?: string;
  updatedAt?: string;
}

export type ProductStatus = "active" | "draft" | "archived";

export type CollectionRule =
  | { type: "all" }
  | { type: "sale" }
  | { type: "tag"; tag: string }
  | { type: "manual"; productIds: string[] };

export interface Collection {
  handle: string;
  title: string;
  description: string;
  image: string;
  rule: CollectionRule;
  /** hidden collections still resolve by URL but aren't listed in nav/chips */
  hidden?: boolean;
  /** parent category handle (WooCommerce-style hierarchy), shown as "Parent › Child" in admin */
  parent?: string;
  ar?: CollectionAr;
  seoTitle?: string;
  seoDescription?: string;
}

export interface Review {
  id: string;
  author: string;
  city: string;
  avatar?: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  size: string;
  height: number;
  weight: number;
  fit: FitTendency;
  photo?: string;
  /** customer photos (WebP under /media/reviews/…), up to 3 */
  photos?: string[];
  helpful: number;
  /** where a review came from when it was collected outside the store (imported) */
  source?: ReviewSource;
  /** written under an active review reward — the storefront must disclose it */
  incentivized?: boolean;
  /** the reviewer didn't say how it fits — excluded from the fit split */
  fitUnknown?: boolean;
}

export type ReviewSource = "instagram" | "whatsapp" | "google" | "tiktok" | "other";

export interface Question {
  q: string;
  a: string;
  author: string;
  date: string;
}

export interface CartLine {
  key: string;
  productId: string;
  color: string;
  size: string;
  qty: number;
}

/* ───────────────────────── Store settings & content (admin-editable) ───────────────────────── */

export interface SiteInfo {
  name: string;
  legalName: string;
  url: string;
  description: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  tiktok: string;
  facebook?: string;
  snapchat?: string;
  youtube?: string;
  x?: string;
  /** Show the fixed social-links rail on the storefront edge (default on) */
  socialRail?: boolean;
  currency: string;
  /** Arabic store description (meta + footer) */
  descriptionAr?: string;
}

export interface OfferSettings {
  bogoEnabled: boolean;
  /** Buy N Get M Free — the cheapest items in each group are free */
  bogo: { buy: number; get: number };
  /** Quantity discount: buy `qty`+ pieces (that aren't already in a Buy-N-Get-M group) → `pct`% off them. Default 2 → 20% */
  multiBuy?: { enabled: boolean; qty: number; pct: number };
  freeShippingAt: number;
  giftAt: number;
  giftName: string;
  shipping: number;
  prepaidDiscountPct: number;
  codFee: number;
  protection: number;
  welcomeCode: string;
  welcomePct: number;
  cutoffHour: number;
}

export interface PromoCode {
  code: string;
  label: string;
  pct?: number;
  amount?: number;
  minSubtotal?: number;
  active: boolean;
  usageLimit?: number;
  used?: number;
  startsAt?: string;
  endsAt?: string;
  /** personal code (e.g. a review reward) — never shipped to the storefront snapshot; unlocked by exact code only */
  private?: boolean;
}

export interface Governorate {
  name: string;
  rate: number;
  days: [number, number];
  enabled?: boolean;
}

export interface PaymentSettings {
  cod: boolean;
  card: boolean;
  wallet: boolean;
  installments: boolean;
}

export interface CheckoutSettings {
  protectionEnabled: boolean;
  orderBumpEnabled: boolean;
  orderBumpProductId: string;
  expressEnabled: boolean;
  expressFee: number;
}

export interface StoreSettings {
  site: SiteInfo;
  offer: OfferSettings;
  promoCodes: PromoCode[];
  governorates: Governorate[];
  payments: PaymentSettings;
  checkout: CheckoutSettings;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface ContentSection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface ContentPage {
  slug: string;
  title: string;
  accent?: string;
  nav: string;
  description: string;
  intro: string;
  sections: ContentSection[];
  published?: boolean;
  ar?: ContentPageAr;
}

export interface FaqGroup {
  group: string;
  items: { q: string; a: string }[];
}

export type HomeSectionId = "hero" | "ribbons" | "categories" | "edit" | "matching-set" | "colour-story" | "reviews" | "trust" | "faq";

export interface HomeContent {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primary: NavLink;
    secondary: NavLink;
    /** product images used in the hero collage, first one is the LCP image */
    images: string[];
    featuredProductId: string;
    /** When true, the hero shows the 3 real best-selling products (by units sold) instead of `images` */
    autoBestsellers?: boolean;
  };
  sections: { id: HomeSectionId; enabled: boolean }[];
  editTitle: string;
  setTitle: string;
  colourStoryTitle: string;
}

export interface StoreContent {
  announcement: NavLink[];
  ribbons: { a: string[]; b: string[] };
  home: HomeContent;
  nav: NavLink[];
  footer: { title: string; links: NavLink[] }[];
  faq: FaqGroup[];
  pages: ContentPage[];
  popups: { welcome: boolean; welcomeDelaySec: number; socialProof: boolean; whatsapp: boolean };
  ar?: StoreContentAr;
}

export interface StoredReview extends Review {
  productId: string;
  status: "published" | "hidden" | "pending";
  /** sample review for client demos / design previews — remove before launch (Backup → Clear demo data) */
  demo?: boolean;
  reply?: string;
  /** order the review was collected from (review-request link) */
  orderId?: string;
  /** review-request id (one personal link) */
  requestId?: string;
  /** single-use promo code issued when this review was published under the review reward */
  rewardCode?: string;
  rewardSentAt?: string;
}

/** Review collection settings (Admin → Reviews / Discounts). */
export interface ReviewSettings {
  /** open the WhatsApp "Request review" prompt right after an order is marked delivered */
  requestPrompt: boolean;
  reward: { enabled: boolean; kind: "pct" | "amount"; value: number; photoRequired: boolean };
}

/** Everything the storefront needs to render — built on the server, hydrated on the client. */
export interface StoreSnapshot {
  version: number;
  products: Product[];
  collections: Collection[];
  settings: StoreSettings;
  content: StoreContent;
  reviews: StoredReview[];
}

/* ───────────────────────── Orders (server-side) ───────────────────────── */

export type OrderStatus = "draft" | "pending" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled" | "returned";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface OrderLine {
  productId: string;
  handle: string;
  title: string;
  color: string;
  size: string;
  qty: number;
  unit: number;
  image: string;
  total: number;
  free: number;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "cod" | "card" | "wallet" | "installments";
  source: "web" | "lp" | "manual";
  customer: { name: string; phone: string; email?: string; whatsappUpdates?: boolean };
  address: { governorate: string; city: string; street: string; building: string; landmark?: string; notes?: string };
  shipping: "standard" | "express";
  lines: OrderLine[];
  totals: { itemCount: number; subtotal: number; bogoDiscount: number; multiDiscount?: number; promoDiscount: number; prepaidDiscount: number; shipping: number; protection: number; bump: number; total: number };
  promoCode?: string;
  timeline: { status: OrderStatus | "note"; at: string; note?: string; by?: string }[];
  tags?: string[];
  demo?: boolean;
  /** set when a cancel/return put this order's units back into stock — guards against double (or skipped) restocks */
  stockRestoredAt?: string;
  /** admin "Create order" idempotency key — a repeated submit returns this order instead of placing another */
  requestId?: string;
  /** shopper's storefront language when the order was placed */
  locale?: Locale;
  /** last time a personal review link was generated for this order */
  reviewRequestedAt?: string;
  /** merchant confirmed the review request was sent (or dismissed it) */
  reviewRequestSentAt?: string;
}

/** Checkout started on the storefront but no order placed yet (abandoned-checkout recovery). */
export interface CheckoutSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  customer: { name?: string; phone?: string; email?: string };
  governorate?: string;
  lines: { productId: string; title: string; color: string; size: string; qty: number; unit: number; image: string }[];
  total: number;
  /** set when an order with the same phone was placed after this checkout */
  recoveredOrder?: string;
  /** last time the merchant sent a recovery message */
  remindedAt?: string;
}

/* ───────────────────────── Localisation (Arabic) ─────────────────────────
 * English is the base language stored in the normal fields. Arabic overrides live
 * in optional `ar` objects; anything missing falls back to English.
 */
export type Locale = "en" | "ar";

export interface ProductAr {
  title?: string;
  tagline?: string;
  /** sanitized rich-text HTML, same allowlist as the English description */
  description?: string;
  highlights?: string[];
  material?: string;
  care?: string[];
  modelInfo?: string;
  category?: string;
  seoTitle?: string;
  seoDescription?: string;
  /** colour name translations keyed by the English colour name */
  colors?: Record<string, string>;
}

export interface CollectionAr {
  title?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ContentPageAr {
  title?: string;
  accent?: string;
  nav?: string;
  description?: string;
  intro?: string;
  sections?: ContentSection[];
}

export interface StoreContentAr {
  announcement?: NavLink[];
  ribbons?: { a?: string[]; b?: string[] };
  hero?: { eyebrow?: string; title?: string; subtitle?: string; primaryLabel?: string; secondaryLabel?: string };
  editTitle?: string;
  setTitle?: string;
  colourStoryTitle?: string;
  /** labels only, same order as content.nav */
  nav?: string[];
  footer?: { title?: string; links?: string[] }[];
  faq?: FaqGroup[];
}
