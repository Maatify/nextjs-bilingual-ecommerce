import type { CollectionRule, Product } from "@/lib/types";

/* Pure collection-rule helpers shared by the admin server queries and client editors. */

type RuleProduct = Pick<Product, "id" | "price" | "compareAt" | "collections">;

/** Mirrors the storefront's membership logic in src/lib/catalog.ts. */
export function matchesRule(rule: CollectionRule, p: RuleProduct) {
  switch (rule.type) {
    case "all":
      return true;
    case "sale":
      return !!p.compareAt && p.compareAt > p.price;
    case "tag":
      return p.collections.includes(rule.tag);
    case "manual":
      return rule.productIds.includes(p.id);
  }
}