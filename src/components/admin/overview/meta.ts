import type { AIconName } from "@/components/admin/icons";
import type { Tone } from "@/components/admin/ui";
import type { OrderStatus } from "@/lib/types";

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  draft: "neutral",
  pending: "amber",
  confirmed: "blue",
  packed: "violet",
  shipped: "pink",
  delivered: "green",
  cancelled: "red",
  returned: "neutral",
};
export interface ActivityRow {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
}

/** Map a free-text activity action ("Deleted product", "Updated settings") to an icon + accent. */
export function activityMeta(action: string): { icon: AIconName; color: string } {
  const a = action.toLowerCase();
  const color = /delet|remov|clear|cancel/.test(a) ? "var(--color-a-danger)" : /creat|add|upload|import|restor|duplicat/.test(a) ? "var(--color-a-ok)" : "var(--color-a-accent)";
  const icon: AIconName = /order/.test(a)
    ? "orders"
    : /product|variant/.test(a)
      ? "products"
      : /stock|inventor/.test(a)
        ? "inventory"
        : /review/.test(a)
          ? "reviews"
          : /collection/.test(a)
            ? "collections"
            : /media|image|upload/.test(a)
              ? "media"
              : /discount|promo|code|offer/.test(a)
                ? "discount"
                : /homepage|home/.test(a)
                  ? "home"
                  : /nav|menu|footer/.test(a)
                    ? "nav"
                    : /faq/.test(a)
                      ? "faq"
                      : /page/.test(a)
                        ? "pages"
                        : /setting|shipping|payment|governorate/.test(a)
                          ? "settings"
                          : /backup|import|export|restor|demo/.test(a)
                            ? "backup"
                            : /customer/.test(a)
                              ? "customers"
                              : /store created|seed/.test(a)
                                ? "store"
                                : "activity";
  return { icon, color };
}
