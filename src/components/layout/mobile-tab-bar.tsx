"use client";

import Link from "@/components/i18n/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/provider";
import { Icon, type IconName } from "@/components/ui/icon";
import { getContent } from "@/lib/data";
import { cx } from "@/lib/format";
import { stripLocale } from "@/lib/i18n/store/config";
import { getSite } from "@/lib/site";
import { actions, useStore } from "@/lib/store";
import { CartCount } from "./header";

const item = "tap relative grid size-12 place-items-center rounded-full transition-[background-color,color,transform] duration-300 active:scale-90";

/**
 * Vestra-style floating dark pill (mobile only). The active tab sits in a light circle.
 * Hidden on PDP / cart / landing pages / checkout, where a sticky CTA owns the bottom edge.
 */
export function MobileTabBar() {
  const pathname = stripLocale(usePathname()).path;
  const { d, t } = useI18n();
  const wish = useStore((s) => s.wishlist.length);
  const cartOpen = useStore((s) => s.cartOpen);
  // always visible on storefront pages (product + cart included); checkout and ad landing pages use their own layouts
  if (pathname.startsWith("/lp/") || pathname.startsWith("/checkout")) return null;

  const tabs: { label: string; href: string; icon: IconName; badge?: number }[] = [
    { label: d.common.home, href: "/", icon: "home" },
    { label: d.common.shop, href: "/collections/all", icon: "grid" },
    { label: d.common.wishlist, href: "/wishlist", icon: "heart", badge: wish },
  ];
  const site = getSite();
  const wa = getContent().popups.whatsapp && site.whatsapp;
  const active = (href: string) => (href === "/" ? pathname === "/" : href === "/collections/all" ? pathname.startsWith("/collections") : pathname.startsWith(href));

  return (
    <nav aria-label={d.layout.tabbar.label} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
      <ul className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-ink p-1.5 text-white shadow-lift">
        {tabs.map((tab) => {
          const on = active(tab.href);
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-label={tab.label} aria-current={on ? "page" : undefined} className={cx(item, on ? "bg-white text-ink" : "text-white/75 hover:text-white")}>
                <Icon name={tab.icon} size={21} filled={on && tab.icon === "heart"} />
                {tab.badge ? <span className="absolute inset-e-2.5 top-2.5 size-2 rounded-full bg-sale ring-2 ring-ink" aria-hidden /> : null}
              </Link>
            </li>
          );
        })}
        <li>
          <button onClick={() => actions.setCartOpen(true)} aria-label={d.layout.header.openBag} className={cx(item, cartOpen ? "bg-white text-ink" : "text-white/75 hover:text-white")}>
            <Icon name="bag" size={21} />
            <CartCount className="inset-e-0.5 top-0.5 bg-sale text-white" />
          </button>
        </li>
        {/* WhatsApp lives in the pill on phones instead of floating on its own (the floating one stays on desktop) */}
        {wa ? (
          <li>
            <a
              href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(t(d.layout.popups.whatsappText, { name: site.name }))}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={d.layout.popups.whatsappLabel}
              className={cx(item, "text-white/75 hover:text-white")}
            >
              <Icon name="whatsapp" size={22} className="wa-shake" />
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
