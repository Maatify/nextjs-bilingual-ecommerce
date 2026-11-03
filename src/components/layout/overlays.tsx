"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { getProducts } from "@/lib/catalog";
import { getContent } from "@/lib/data";
import { cx } from "@/lib/format";
import { stripLocale } from "@/lib/i18n/store/config";
import type { Dict } from "@/lib/i18n/store/en";
import type { I18n } from "@/lib/i18n/store/kit";
import { bogoLabel } from "@/lib/pricing";
import { getOffer, getPromoCodes, getSite } from "@/lib/site";
import { socialLinks } from "@/lib/social";
import { useStore } from "@/lib/store";
import { NewsletterForm } from "./newsletter-form";

/** Generic toast (wishlist saves, etc.). */
export function Toaster() {
  const toast = useStore((s) => s.toast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            initial={{ y: -20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 380 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2 ps-2 pe-5 text-white shadow-lift"
          >
            {toast.image ? (
              <span className="relative size-9 overflow-hidden rounded-full">
                <Image src={toast.image} alt="" fill sizes="36px" className="object-cover" />
              </span>
            ) : (
              <span className="grid size-9 place-items-center rounded-full bg-forest">
                <Icon name="check" size={18} />
              </span>
            )}
            <span className="text-[13px] leading-tight">
              <b className="block">{toast.title}</b>
              {toast.body ? <span className="text-white/70">{toast.body}</span> : null}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type Purchase = { first: string; governorate: string; productId: string; at: string };

function ago(iso: string, d: Dict, t: I18n["t"]) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return t(d.layout.popups.minAgo, { n: m });
  const h = Math.round(m / 60);
  return h < 24 ? t(d.layout.popups.hAgo, { n: h }) : d.layout.popups.yesterday;
}

/**
 * Recent-purchase pop — REAL orders only (last 48h, first name + governorate + product, from
 * /api/recent-purchases). Shows nothing when there are none. Calm cadence (first at 30s, every
 * ~50s, max 3/session), dismissible, never on checkout/PDP.
 */
export function SocialProof() {
  const pathname = stripLocale(usePathname()).path;
  const { d, t, product, gov, locale } = useI18n();
  const [items, setItems] = useState<Purchase[]>([]);
  const [n, setN] = useState(-1);
  const [hidden, setHidden] = useState(false);
  const products = getProducts();
  const off = hidden || !getContent().popups.socialProof || !products.length || pathname.startsWith("/checkout") || pathname.startsWith("/products/");

  useEffect(() => {
    if (off) return;
    const ctrl = new AbortController();
    fetch("/api/recent-purchases", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Purchase[] }) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [off]);

  const usable = items.filter((x) => products.some((p) => p.id === x.productId));
  const has = usable.length > 0;

  useEffect(() => {
    if (off || !has) return;
    let count = 0;
    let show: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    const cycle = (delay: number) => {
      show = setTimeout(() => {
        if (count++ >= 3) return;
        setN((x) => x + 1);
        hide = setTimeout(() => setN(-1), 4800);
        cycle(50000);
      }, delay);
    };
    cycle(30000);
    return () => (clearTimeout(show), clearTimeout(hide));
  }, [off, has]);

  const item = has && n >= 0 ? usable[n % usable.length] : undefined;
  const p = item ? products.find((x) => x.id === item.productId) : undefined;
  const image = p?.colors[0]?.images[0];

  return (
    <AnimatePresence>
      {item && !off && p && image ? (
        <motion.aside
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed bottom-[92px] inset-s-4 z-40 flex max-w-[280px] items-center gap-3 rounded-[18px] bg-white p-2 pe-9 shadow-soft ring-1 ring-ink/5 md:bottom-6 md:inset-s-6"
          aria-label={d.layout.popups.recentPurchase}
        >
          <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded-xl bg-well">
            <Image src={image} alt="" fill sizes="40px" className="object-cover" />
          </span>
          <span className="min-w-0 text-[12.5px] leading-snug">
            <span className="block truncate font-semibold">{product(p).title}</span>
            <span className="block truncate text-muted">
              <bdi>{item.first}</bdi>{locale === "ar" ? "، " : ", "}{gov(item.governorate)} · {ago(item.at, d, t)}
            </span>
          </span>
          <button onClick={() => setHidden(true)} aria-label={d.layout.popups.dismiss} className="tap absolute inset-e-1.5 top-1.5 grid size-7 place-items-center rounded-full text-muted hover:bg-ink/5">
            <Icon name="close" size={14} />
          </button>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

/** `docked`: on phones the store's tab bar carries WhatsApp (mobile-tab-bar.tsx), so the floating button is desktop-only there. */
export function WhatsAppButton({ docked = false }: { docked?: boolean }) {
  const pathname = stripLocale(usePathname()).path;
  const { d, t } = useI18n();
  const site = getSite();
  if (!getContent().popups.whatsapp || !site.whatsapp || pathname.startsWith("/checkout") || pathname === "/cart") return null;
  return (
    <a
      href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(t(d.layout.popups.whatsappText, { name: site.name }))}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={d.layout.popups.whatsappLabel}
      className={cx(
        "tap fixed inset-e-4 z-40 size-12 place-items-center rounded-full bg-[#25d366] text-white shadow-soft transition hover:scale-105 active:scale-95 md:inset-e-6 md:size-13",
        docked ? "hidden md:grid" : "grid",
        // PDP / LP: sit above the sticky add-to-bag (on tablets too — the PDP bar spans the width up to ~1030px and the button
        // covered its "Select a size" CTA at 768px); elsewhere: level with the centred tab bar
        pathname.startsWith("/products/") ? "bottom-[156px] md:bottom-[108px]" : pathname.startsWith("/lp/") ? "bottom-[100px] md:bottom-6" : "bottom-[calc(max(12px,env(safe-area-inset-bottom))+6px)] md:bottom-6",
      )}
    >
      {/* attention cue: two radar rings, a periodic ring-shake of the icon and an unread-style dot */}
      <span aria-hidden className="wa-ring" />
      <span aria-hidden className="wa-ring wa-ring-2" />
      <Icon name="whatsapp" size={24} className="wa-shake relative" />
      {/* the "1" is CSS content, not DOM text: as text it made the link's visible label "1" ≠ its aria-label (WCAG 2.5.3 label-in-name) */}
      <span aria-hidden className="wa-dot absolute -top-0.5 -end-0.5 grid size-[18px] place-items-center rounded-full bg-[#ff3b30] text-[10.5px] font-bold leading-none text-white ring-2 ring-white after:content-['1']" />
    </a>
  );
}

/**
 * Social rail — fixed on the inline-start edge, vertically centred (WhatsApp lives on the other side).
 * Desktop: an always-open pill of icons with a small vertical "Follow us" label. Mobile: a slim tab that
 * opens the same pill on tap, so it never covers the content. Links come from Settings → Social media;
 * hidden when none are set, when the admin switches it off, and on checkout / ad landing pages.
 */
export function SocialRail() {
  const pathname = stripLocale(usePathname()).path;
  const { d, t } = useI18n();
  // remember which page it was opened on, so it closes by itself on navigation
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);
  const site = getSite();
  const links = socialLinks(site);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (site.socialRail === false || !links.length || pathname.startsWith("/checkout") || pathname.startsWith("/lp/")) return null;
  return (
    <aside aria-label={d.layout.popups.follow} className="social-rail fixed inset-s-0 top-1/2 z-30 -translate-y-1/2">
      {/* mobile tab */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="social-rail-links"
        aria-label={d.layout.popups.followToggle}
        onClick={() => setOpen(!open)}
        className={cx(
          "tap grid h-14 w-7 place-items-center rounded-e-[14px] bg-ink text-white shadow-soft transition duration-300 ease-[var(--ease-out-soft)] md:hidden",
          open && "pointer-events-none -translate-x-full opacity-0 rtl:translate-x-full",
        )}
      >
        <Icon name="share" size={15} />
      </button>
      <div
        id="social-rail-links"
        className={cx(
          "absolute inset-s-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-e-[24px] bg-surface py-2 ps-1.5 pe-2 shadow-soft ring-1 ring-line transition duration-300 ease-[var(--ease-out-soft)]",
          "md:static md:translate-y-0 md:opacity-100 md:visible",
          open ? "visible translate-x-0 opacity-100" : "invisible -translate-x-full opacity-0 rtl:translate-x-full md:rtl:translate-x-0 md:translate-x-0",
        )}
      >
        {links.map((n) => (
          <a
            key={n.key}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t(d.layout.popups.followOn, { network: n.label })}
            className="tap grid size-10 place-items-center rounded-full text-ink transition hover:bg-ink hover:text-white active:scale-95"
          >
            <Icon name={n.key} size={18} />
          </a>
        ))}
        <span aria-hidden className="my-1 h-6 w-px bg-line" />
        <span aria-hidden className="social-rail-label pb-1 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
          {d.layout.popups.follow}
        </span>
        {/* mobile only: closes the opened pill */}
        <button type="button" onClick={() => setOpen(false)} aria-label={d.common.close} className="tap mt-1 grid size-8 place-items-center rounded-full text-muted transition hover:text-ink md:hidden">
          <Icon name="close" size={14} />
        </button>
      </div>
    </aside>
  );
}

/**
 * Welcome offer — fires on exit intent (desktop) or after the admin-set delay / 60% scroll (mobile),
 * once per 3 days, never on checkout or for returning customers who already have items in cart.
 */
export function WelcomeOffer() {
  const pathname = stripLocale(usePathname()).path;
  const { d, t, locale } = useI18n();
  const w = d.layout.popups;
  const hasCart = useStore((s) => s.cart.length > 0);
  const [open, setOpen] = useState(false);
  const { popups, home } = getContent();
  const OFFER = getOffer();
  const enabled = popups.welcome;
  const delayMs = Math.max(3, popups.welcomeDelaySec || 40) * 1000;
  const welcome = getPromoCodes()[OFFER.welcomeCode?.toUpperCase()];
  const bogo = bogoLabel(locale);
  const image = home.hero.images[1] || home.hero.images[0] || "/p/crew/bone-1.webp";

  useEffect(() => {
    if (!enabled || pathname.startsWith("/checkout") || hasCart) return;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem("verda:welcome") ?? 0);
    } catch {}
    if (Date.now() - seen < 3 * 864e5) return;

    const fire = () => {
      try {
        localStorage.setItem("verda:welcome", String(Date.now()));
      } catch {}
      setOpen(true);
      cleanup();
    };
    const onLeave = (e: MouseEvent) => e.clientY <= 0 && fire();
    const onScroll = () => window.scrollY / (document.body.scrollHeight - innerHeight) > 0.6 && fire();
    const t = setTimeout(fire, delayMs);
    document.addEventListener("mouseleave", onLeave);
    if (matchMedia("(max-width: 767px)").matches) window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      clearTimeout(t);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, [pathname, hasCart, enabled, delayMs]);

  if (!enabled) return null;

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={w.welcomeTitle} side="center" width="max-w-[760px]" hideHeader>
      <div className="grid gap-6 pt-4 md:grid-cols-2 md:pt-6">
        <div className="relative hidden aspect-[4/5] overflow-hidden rounded-[22px] bg-well md:block">
          <Image src={image} alt="" fill sizes="360px" loading="lazy" className="object-cover" />
        </div>
        <div className="flex flex-col justify-center pb-2">
          <button onClick={() => setOpen(false)} className="tap absolute inset-e-4 top-4 grid size-11 place-items-center rounded-full bg-surface-2" aria-label={d.common.close}>
            <Icon name="close" size={18} />
          </button>
          {/* pe-12 keeps the headline clear of the close button (it ran under it in Arabic at 360px) */}
          <p className="text-poster pe-12">{welcome && OFFER.welcomePct ? t(w.welcomePct, { pct: OFFER.welcomePct }) : w.firstDibs}</p>
          <p className="mt-3 text-[15px] text-muted">{welcome && bogo ? t(w.stacks, { offer: bogo }) : w.joinBody}</p>
          <NewsletterForm tone="light" source="welcome-popup" onDone={() => setTimeout(() => setOpen(false), 2600)} />
          <button onClick={() => setOpen(false)} className="tap mt-1 self-start text-[13px] text-muted underline underline-offset-4">
            {w.noThanks}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
