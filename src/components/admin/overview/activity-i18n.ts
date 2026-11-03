import type { AdminKey, TFn } from "@/lib/i18n/admin";

/*
 * Activity entries are stored as English phrases ("Updated category", "Deleted 3 products") so the
 * log stays language-neutral in the DB. These helpers translate known phrases for display and fall
 * back to the stored text for anything unknown.
 */

const EXACT: Record<string, string> = {
  "Sign-in failed": "signInFailed",
  "Signed in": "signedIn",
  "Signed out everywhere": "signedOutEverywhere",
  "Session revoked": "sessionRevoked",
  "Two-factor authentication enabled": "twoFaOn",
  "Two-factor authentication disabled": "twoFaOff",
  "Recovery codes regenerated": "recoveryRegenerated",
  "Recovery code used": "recoveryUsed",
  "Password changed": "passwordChanged",
  "Password change failed": "passwordChangeFailed",
  "Admin password stored": "passwordStored",
  "Admin password reset": "passwordReset",
  "Uploaded media": "uploadedMedia",
  "Deleted media": "deletedMedia",
  "Updated stock": "updatedStock",
  "Updated settings": "updatedSettings",
  "Updated page": "updatedPage",
  "Created page": "createdPage",
  "Deleted page": "deletedPage",
  "Published page": "publishedPage",
  "Unpublished page": "unpublishedPage",
  "Updated order tags": "updatedOrderTags",
  "Updated navigation": "updatedNavigation",
  "Updated homepage": "updatedHomepage",
  "Updated automatic offers": "updatedOffers",
  "Updated FAQ": "updatedFaq",
  "Sent checkout recovery": "sentRecovery",
  "Review submitted": "reviewSubmitted",
  "Reordered products": "reorderedProducts",
  "Reordered categories": "reorderedCategories",
  "Renamed tag": "renamedTag",
  "Merged tags": "mergedTags",
  "Deleted tag": "deletedTag",
  "Quick-edited product": "quickEditedProduct",
  "Created product": "createdProduct",
  "Updated product": "updatedProduct",
  "Duplicated product": "duplicatedProduct",
  "Deleted product": "deletedProduct",
  "Order placed": "orderPlaced",
  "New subscriber": "newSubscriber",
  "Message received": "messageReceived",
  "Item added to order": "itemAddedToOrder",
  "Imported backup": "importedBackup",
  "Edited order details": "editedOrderDetails",
  "Deleted promo code": "deletedPromo",
  "Created promo code": "createdPromo",
  "Updated promo code": "updatedPromo",
  "Activated promo code": "activatedPromo",
  "Paused promo code": "pausedPromo",
  "Created order": "createdOrder",
  "Created draft order": "createdDraft",
  "Updated draft order": "updatedDraft",
  "Created category": "createdCategory",
  "Updated category": "updatedCategory",
  "Deleted category": "deletedCategory",
  "Cleared demo orders": "clearedDemo",
  "Added review": "addedReview",
  "Replied to review": "repliedReview",
  "Removed review reply": "removedReviewReply",
  "Added order note": "addedOrderNote",
  "Store created": "storeCreated",
  "Created product variants": "createdVariants",
};

const WORDS = ["draft", "pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned", "paid", "unpaid", "refunded", "active", "archived"];
const word = (t: TFn, w: string) => (WORDS.includes(w.toLowerCase()) ? t(`overview.activity.words.${w.toLowerCase()}` as AdminKey) : w);

const PATTERNS: [RegExp, (t: TFn, m: RegExpMatchArray) => string][] = [
  [/^Order (\w+)$/, (t, m) => t("overview.activity.actions.orderStatus", { status: word(t, m[1]) })],
  [/^Bulk: (\d+) orders? → (\w+)$/, (t, m) => t("overview.activity.actions.bulkOrders", { count: +m[1], status: word(t, m[2]) })],
  [/^Payment (\w+)$/, (t, m) => t("overview.activity.actions.payment", { status: word(t, m[1]) })],
  [/^Deleted (\d+) messages?$/, (t, m) => t("overview.activity.actions.deletedMessages", { count: +m[1] })],
  [/^Deleted (\d+) draft orders?$/, (t, m) => t("overview.activity.actions.deletedDrafts", { count: +m[1] })],
  [/^Deleted (\d+) abandoned checkouts?$/, (t, m) => t("overview.activity.actions.deletedCheckouts", { count: +m[1] })],
  [/^Deleted (\d+) reviews?$/, (t, m) => t("overview.activity.actions.deletedReviews", { count: +m[1] })],
  [/^Deleted (\d+) products?$/, (t, m) => t("overview.activity.actions.deletedProducts", { count: +m[1] })],
  [/^Deleted (\d+) tags?$/, (t, m) => t("overview.activity.actions.deletedTags", { count: +m[1] })],
  [/^Deleted (\d+) categor(?:y|ies)$/, (t, m) => t("overview.activity.actions.deletedCategories", { count: +m[1] })],
  [/^Bulk-edited (\d+) products?$/, (t, m) => t("overview.activity.actions.bulkEdited", { count: +m[1] })],
  [/^Set (\d+) products? to (\w+)$/, (t, m) => t("overview.activity.actions.setProducts", { count: +m[1], status: word(t, m[2]) })],
  [/^Published (\d+) reviews?$/, (t, m) => t("overview.activity.actions.reviewsPublished", { count: +m[1] })],
  [/^Hid (\d+) reviews?$/, (t, m) => t("overview.activity.actions.reviewsHidden", { count: +m[1] })],
  [/^Unpublished (\d+) reviews?$/, (t, m) => t("overview.activity.actions.reviewsUnpublished", { count: +m[1] })],
];

/** Display text for a stored activity action. */
export function activityLabel(t: TFn, action: string): string {
  const key = EXACT[action];
  if (key) return t(`overview.activity.actions.${key}` as AdminKey);
  for (const [re, fn] of PATTERNS) {
    const m = action.match(re);
    if (m) return fn(t, m);
  }
  return action;
}

const DETAIL: [RegExp, (t: TFn, m: RegExpMatchArray) => string][] = [
  [/^(\d+) products?$/, (t, m) => t("overview.activity.detail.products", { count: +m[1] })],
  [/^(\d+) orders?$/, (t, m) => t("overview.activity.detail.orders", { count: +m[1] })],
  [/^(\d+) variants? changed$/, (t, m) => t("overview.activity.detail.variants", { count: +m[1] })],
  [/^wrong password( · .*)?$/, (t, m) => t("overview.activity.detail.wrongPassword") + (m[1] ?? "")],
  [/^(\d+) skipped$/, (t, m) => t("overview.activity.detail.skipped", { count: +m[1] })],
  [/^Safety copy: (.+)$/, (t, m) => t("overview.activity.detail.safetyCopy", { path: m[1] })],
  [/^(\d+) products? · (\d+) orders?$/, (t, m) => `${t("overview.activity.detail.products", { count: +m[1] })} · ${t("overview.activity.detail.orders", { count: +m[2] })}`],
];

/** Translate simple generated targets/details ("12 products", "3 skipped"); free text is returned as is. */
export function activityDetail(t: TFn, text: string): string {
  for (const [re, fn] of DETAIL) {
    const m = text.match(re);
    if (m) return fn(t, m);
  }
  return text;
}

/** "admin" / "system" actor names. */
export function actorLabel(t: TFn, actor: string): string {
  return actor === "admin" || actor === "system" || actor === "customer" ? t(`overview.activity.actors.${actor}`) : actor;
}
