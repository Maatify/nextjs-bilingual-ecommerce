"use client";

import Image from "next/image";
import Link from "@/components/i18n/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { getCategoryCollections, getVisibleCollections } from "@/lib/catalog";
import { getContent } from "@/lib/data";
import { cx } from "@/lib/format";
import { stripLocale, type Locale } from "@/lib/i18n/store/config";
import { localizeCollection, localizeContent } from "@/lib/i18n/store/content";
import type { Dict } from "@/lib/i18n/store/en";
import { getSite } from "@/lib/site";
import { actions, useStore } from "@/lib/store";
import { OffersBell } from "./offers-bell";

type NavItem = { label: string; href: string; sale?: boolean };

/** Main nav from /admin → Content → Navigation; links to a sale collection get the sale colour. */
function getNav(locale: Locale): NavItem[] {
  const sale = new Set(getVisibleCollections().filter((c) => c.rule.type === "sale").map((c) => `/collections/${c.handle}`));
  return localizeContent(getContent(), locale).nav.map((n) => ({ ...n, sale: sale.has(n.href) }));
}

/** Drawer list: visible edits that aren't in the main nav or tiles (Bestsellers, New drop…), then the main nav. */
function getDrawerLinks(nav: NavItem[], tileHandles: Set<string>, locale: Locale): NavItem[] {
  const inNav = new Set(nav.map((n) => n.href));
  const extra = getVisibleCollections()
    .filter((c) => c.rule.type !== "all" && !tileHandles.has(c.handle) && !inNav.has(`/collections/${c.handle}`))
    .map((c) => ({ label: localizeCollection(c, locale).title, href: `/collections/${c.handle}`, sale: c.rule.type === "sale" }));
  return [...extra, ...nav];
}

/** "VERDA" → "Verda" for the poster-type wordmark. */
const wordmark = (name: string) => name.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const quick = (d: Dict): { l: string; h: string; i: IconName }[] => [
  { l: d.common.trackOrder, h: "/track-order", i: "package" },
  { l: d.common.wishlist, h: "/wishlist", i: "heart" },
  { l: d.common.sizeGuide, h: "/pages/size-guide", i: "ruler" },
  { l: d.common.helpFaq, h: "/pages/faq", i: "info" },
];

export function Logo({ className }: { className?: string }) {
  const name = getSite().name;
  const { d, t } = useI18n();
  // the Latin wordmark is a logo — always LTR, always the Anton poster cut (also on Arabic pages)
  return (
    <Link href="/" dir="ltr" style={{ fontFamily: "var(--font-anton), Impact, sans-serif" }} aria-label={t(d.layout.header.logoHome, { name })} className={cx("font-poster text-[26px] leading-none tracking-[0.02em]", className)}>
      <span lang="en" className="uppercase tracking-[0.02em]">
        {wordmark(name)}
        <span className="text-forest">.</span>
      </span>
    </Link>
  );
}

export function CartCount({ className }: { className?: string }) {
  const count = useStore((s) => s.cart.reduce((n, l) => n + l.qty, 0));
  if (!count) return null;
  return (
    <span
      key={count}
      className={cx(
        "absolute grid h-[18px] min-w-[18px] animate-[pop_.35s_var(--ease-out-soft)] place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums",
        className ?? "-inset-e-0.5 -top-0.5 bg-ink text-white",
      )}
    >
      {count}
    </span>
  );
}

export function Header() {
  const fullPath = usePathname();
  const { d, t, locale, collection } = useI18n();
  const pathname = stripLocale(fullPath).path;
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const wishCount = useStore((s) => s.wishlist.length);
  const NAV = getNav(locale);
  const DRAWER_TILES = getCategoryCollections();
  const DRAWER_LINKS = getDrawerLinks(NAV, new Set(DRAWER_TILES.map((c) => c.handle)), locale);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // close the drawer on navigation (state adjusted during render, not in an effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenu(false);
  }

  return (
    <>
      <header
        className={cx("sticky top-0 z-40 transition-[background-color,box-shadow] duration-300", scrolled ? "bg-bg shadow-[0_1px_0_var(--color-line)]" : "bg-bg")}
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="container-x grid h-[var(--header-h)] grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* start side: menu + offers (mobile) · logo (desktop) */}
          <div className="flex items-center">
            <IconButton label={t(d.layout.header.openMenu)} className="-ms-2.5 lg:hidden" onClick={() => setMenu(true)}>
              <Icon name="menu" size={22} />
            </IconButton>
            <span className="lg:hidden">
              <OffersBell />
            </span>
            <Logo className="hidden lg:block" />
          </div>

          {/* centre: logo (mobile) · nav (desktop) */}
          <Logo className="lg:hidden" />
          <nav aria-label={d.layout.header.mainNav} className="hidden lg:block">
            <ul className="flex items-center">
              {NAV.map((n) => {
                const on = pathname === n.href;
                return (
                  <li key={`${n.href}|${n.label}`}>
                    <Link
                      href={n.href}
                      aria-current={on ? "page" : undefined}
                      className={cx(
                        "tap flex h-10 items-center rounded-full px-3 text-[14px] font-medium transition hover:bg-ink/5 xl:px-4",
                        on && "bg-ink text-white hover:bg-ink",
                        n.sale && !on && "text-sale",
                      )}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* end side: language · search · offers · wishlist · bag */}
          <div className="flex items-center justify-end">
            {/* under 340px (Galaxy Fold cover screen) the row pushed the bag off-screen; the menu and footer still switch language */}
            <LanguageSwitcher className="me-0.5 max-[339px]:hidden lg:me-1.5" />
            <IconButton label={d.common.search} onClick={() => actions.setSearchOpen(true)}>
              <Icon name="search" size={21} />
            </IconButton>
            <span className="hidden lg:block">
              <OffersBell />
            </span>
            <Link href="/wishlist" aria-label={t(d.layout.header.wishlistCount, { n: wishCount })} className="tap relative hidden size-11 place-items-center rounded-full transition hover:bg-ink/6 lg:grid">
              <Icon name="heart" size={21} />
              {wishCount ? <span className="absolute inset-e-2 top-2 size-2 rounded-full bg-sale" aria-hidden /> : null}
            </Link>
            <IconButton label={d.layout.header.openBag} className="relative -me-2.5 lg:me-0" onClick={() => actions.setCartOpen(true)}>
              <Icon name="bag" size={22} />
              <CartCount />
            </IconButton>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Sheet open={menu} onClose={() => setMenu(false)} title={<Logo />} side="left" width="max-w-[380px]">
        <nav aria-label={d.layout.header.mobileNav}>
          <ul className="no-scrollbar -mx-5 mb-4 flex gap-3 overflow-x-auto px-5 pb-1">
            {DRAWER_TILES.map((c) => (
              <li key={c.handle} className="shrink-0">
                <Link href={`/collections/${c.handle}`} className="flex w-[72px] flex-col items-center gap-2 text-center">
                  <span className="relative block size-[72px] overflow-hidden rounded-full bg-well">
                    <Image src={c.image} alt="" fill sizes="72px" className="scale-[1.35] object-cover object-[50%_35%]" />
                  </span>
                  <span className="text-[12px] font-medium">{c.title === "T-Shirts" && locale === "en" ? d.layout.header.tees : collection(c).title}</span>
                </Link>
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-line">
            {DRAWER_LINKS.map((n) => (
              <li key={`${n.href}|${n.label}`}>
                <Link href={n.href} className={cx("flex h-14 items-center justify-between text-[17px] font-medium", n.sale && "text-sale")}>
                  {n.label}
                  <Icon name="chevronRight" size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 grid grid-cols-2 gap-2 text-[14px]">
            {quick(d).map((x) => (
              <li key={x.h}>
                <Link href={x.h} className="flex h-12 items-center gap-2 rounded-2xl bg-surface-2 px-4 font-medium">
                  <Icon name={x.i} size={18} /> {x.l}
                </Link>
              </li>
            ))}
          </ul>
          <LanguageSwitcher variant="row" className="mt-2 w-full justify-between" />
        </nav>
      </Sheet>
    </>
  );
}
