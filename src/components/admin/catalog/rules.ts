import type { TFn } from "@/lib/i18n/admin";
import type { Collection, CollectionRule, Product } from "@/lib/types";

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

export const inCollection = (c: Collection, p: RuleProduct) => matchesRule(c.rule, p);

export function ruleSummary(rule: CollectionRule, titles?: Record<string, string>, t?: TFn) {
  switch (rule.type) {
    case "all":
      return t ? t("catalog.rules.all") : "All products";
    case "sale":
      return t ? t("catalog.rules.sale") : "Products on sale";
    case "tag": {
      const tag = titles?.[rule.tag] ?? rule.tag;
      return t ? t("catalog.rules.tagged", { tag }) : `Tagged “${tag}”`;
    }
    case "manual":
      return t ? t("catalog.rules.manual", { count: rule.productIds.length }) : `${rule.productIds.length} hand-picked`;
  }
}
