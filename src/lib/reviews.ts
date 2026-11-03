import { snapshot } from "./data";
import { localizeContent } from "./i18n/store/content";
import type { Locale, Product, Question, Review, StoredReview } from "./types";

/*
 * Reviews and questions shown on the storefront. Everything here comes from the
 * database: customer-written reviews that an admin published, and the admin-managed
 * FAQ. Nothing is generated.
 */

/** Published reviews for a product, newest first (admin-moderated, from the store snapshot). */
export function getReviews(p: Product, count = 12): (Review & { reply?: string })[] {
  // explicit field list: private bookkeeping (order / link ids, reward codes) never reaches the page
  return snapshot()
    .reviews.filter((r) => r.productId === p.id && r.status === "published")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count)
    .map((r: StoredReview) => ({ id: r.id, author: r.author, city: r.city, avatar: r.avatar, rating: r.rating, title: r.title, body: r.body, date: r.date, verified: r.verified, size: r.size, height: r.height, weight: r.weight, fit: r.fit, photo: r.photo, photos: r.photos ?? (r.photo ? [r.photo] : undefined), source: r.source, incentivized: r.incentivized, fitUnknown: r.fitUnknown, helpful: r.helpful, reply: r.reply }));
}

/** Real star distribution (percent per 5★…1★) from every published review of the product. */
export function ratingBreakdown(p: Product): [number, number, number, number, number] {
  const all = snapshot().reviews.filter((r) => r.productId === p.id && r.status === "published");
  if (!all.length) return [0, 0, 0, 0, 0];
  const n = [5, 4, 3, 2, 1].map((star) => all.filter((r) => Math.round(r.rating) === star).length);
  return n.map((x) => Math.round((x / all.length) * 100)) as [number, number, number, number, number];
}

/**
 * Product-page questions = the store's admin-managed FAQ (Admin → FAQ), not invented
 * customer Q&A. Shown in the order the admin arranged them.
 */
export function getQuestions(p?: Product, limit = 6, locale: Locale = "en"): Question[] {
  const items = (localizeContent(snapshot().content, locale).faq ?? []).flatMap((g) => g.items);
  return items.slice(0, limit).map((it) => ({ q: it.q, a: it.a, author: "", date: "" }));
}
