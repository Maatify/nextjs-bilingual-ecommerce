"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { logoutAction } from "@/app/admin/login/actions";
import { PageTransition } from "@/components/fx/page-transition";
import { FxRuntime } from "@/components/fx/runtime";
import { cx } from "@/lib/format";
import { AIcon, type AIconName } from "./icons";
import { useT } from "./i18n/provider";
import { LangSwitch } from "./i18n/lang-switch";
import { makeT, type AdminKey } from "@/lib/i18n/admin";
import { ease, Kbd, Modal, useAdminTheme, useDialogFocus, type AdminTheme } from "./ui";

export interface ShellCounts {
  openOrders: number;
  pendingReviews: number;
  lowStock: number;
  todayOrders: number;
  /** unread contact-form messages (filled by the panel layout) */
  unreadMessages: number;
  /** abandoned (not recovered) checkouts started today */
  abandonedToday: number;
}
export interface SearchIndex {
  products: { id: string; title: string; image: string; status: string }[];
  orders: { id: string; number: string; name: string; total: number }[];
}

/* ───────────── Navigation (Shopify / WooCommerce style: sections with collapsible sub-items) ───────────── */

type Leaf = { href: string; label: AdminKey; badge?: keyof ShellCounts; /** extra path prefixes that belong to this item */ also?: string[] };
type Section = { key: string; label: AdminKey; icon: AIconName; href: string; badge?: keyof ShellCounts; exact?: boolean; children?: Leaf[] };

const SETTINGS_TABS: { tab: string; label: AdminKey }[] = [
  { tab: "store", label: "shell.nav.general" },
  { tab: "shipping", label: "shell.nav.shipping" },
  { tab: "payments", label: "shell.nav.payments" },
  { tab: "checkout", label: "shell.nav.checkout" },
  { tab: "security", label: "shell.nav.security" },
];

const NAV: Section[] = [
  { key: "home", label: "shell.nav.home", icon: "home", href: "/admin", exact: true },
  {
    key: "orders",
    label: "shell.nav.orders",
    icon: "orders",
    href: "/admin/orders",
    badge: "openOrders",
    children: [
      { href: "/admin/orders", label: "shell.nav.allOrders" },
      { href: "/admin/orders/drafts", label: "shell.nav.drafts", also: ["/admin/orders/new"] },
      { href: "/admin/orders/checkouts", label: "shell.nav.abandoned", badge: "abandonedToday" },
    ],
  },
  {
    key: "products",
    label: "shell.nav.products",
    icon: "products",
    href: "/admin/products",
    children: [
      { href: "/admin/products", label: "shell.nav.allProducts" },
      { href: "/admin/products/new", label: "shell.nav.addProduct" },
      { href: "/admin/categories", label: "shell.nav.categories", also: ["/admin/collections"] },
      { href: "/admin/tags", label: "shell.nav.tags" },
      { href: "/admin/inventory", label: "shell.nav.inventory", badge: "lowStock" },
    ],
  },
  {
    key: "customers",
    label: "shell.nav.customers",
    icon: "customers",
    href: "/admin/customers",
    children: [
      { href: "/admin/customers", label: "shell.nav.allCustomers" },
      { href: "/admin/messages", label: "shell.nav.messages", badge: "unreadMessages" },
      { href: "/admin/reviews", label: "shell.nav.reviews", badge: "pendingReviews" },
    ],
  },
  { key: "marketing", label: "shell.nav.marketing", icon: "discount", href: "/admin/discounts", children: [{ href: "/admin/discounts", label: "shell.nav.discounts" }] },
  {
    key: "content",
    label: "shell.nav.content",
    icon: "pages",
    href: "/admin/homepage",
    children: [
      { href: "/admin/homepage", label: "shell.nav.homepage" },
      { href: "/admin/navigation", label: "shell.nav.navigation" },
      { href: "/admin/pages", label: "shell.nav.pages" },
      { href: "/admin/faq", label: "shell.nav.faq" },
      { href: "/admin/media", label: "shell.nav.media" },
    ],
  },
  { key: "analytics", label: "shell.nav.analytics", icon: "analytics", href: "/admin/analytics" },
  { key: "settings", label: "shell.nav.settings", icon: "settings", href: "/admin/settings", children: SETTINGS_TABS.map((t) => ({ href: t.tab === "store" ? "/admin/settings" : `/admin/settings?tab=${t.tab}`, label: t.label })) },
  { key: "activity", label: "shell.nav.activity", icon: "activity", href: "/admin/activity" },
  { key: "backup", label: "shell.nav.backup", icon: "backup", href: "/admin/backup" },
];

const pathOf = (href: string) => href.split("?")[0];
const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

/** The active section + leaf for a URL (longest matching prefix wins; settings tabs match on ?tab=). */
function locate(path: string, tab: string | null): { section: Section; leaf?: Leaf } | null {
  let best: { section: Section; leaf?: Leaf; len: number } | null = null;
  for (const sec of NAV) {
    if (sec.exact ? path === sec.href : under(path, sec.href)) if (!best || sec.href.length > best.len) best = { section: sec, len: sec.href.length };
    for (const leaf of sec.children ?? []) {
      const base = pathOf(leaf.href);
      if (base === "/admin/settings") {
        if (path !== base) continue;
        const t = new URLSearchParams(leaf.href.split("?")[1] ?? "").get("tab") ?? "store";
        if (t === (tab ?? "store")) best = { section: sec, leaf, len: Infinity };
        continue;
      }
      for (const prefix of [base, ...(leaf.also ?? [])]) if (under(path, prefix) && (!best || prefix.length > best.len || (prefix.length === best.len && !best.leaf))) best = { section: sec, leaf, len: prefix.length };
    }
  }
  return best;
}

function useLocation() {
  const path = usePathname();
  const params = useSearchParams();
  const tab = path === "/admin/settings" ? params.get("tab") : null;
  return { path, tab, here: locate(path, tab) };
}

function CountBadge({ n, tone }: { n: number; tone: "warn" | "accent" }) {
  return (
    <motion.span key={n} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 26 }} className={cx("relative ms-auto grid h-5 min-w-5 place-items-center rounded-md px-1.5 text-[11px] font-medium tabular-nums", tone === "warn" ? "bg-a-warn/15 text-a-warn" : "bg-a-violet/20 text-a-accent")}>
      {n}
    </motion.span>
  );
}
const toneOf = (k?: keyof ShellCounts) => (k === "lowStock" || k === "abandonedToday" ? "warn" : "accent");

function Sidebar({ counts, onNavigate, onSettingsTab }: { counts: ShellCounts; onNavigate?: () => void; onSettingsTab?: (tab: string) => void }) {
  const { t, isRtl } = useT();
  const { here } = useLocation();
  const activeKey = here?.section.key;
  // sections the user opened/closed by hand; the active section is always open
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [lastActive, setLastActive] = useState(activeKey);
  if (lastActive !== activeKey) {
    // navigating into a section re-opens it (Shopify behaviour)
    setLastActive(activeKey);
    if (activeKey && toggled[activeKey] === false) setToggled((t) => ({ ...t, [activeKey]: true }));
  }
  const isOpen = (sec: Section) => toggled[sec.key] ?? sec.key === activeKey;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pb-4 pt-5">
        <span className="a-grad grid size-9 shrink-0 place-items-center rounded-[11px] font-poster text-[17px] text-white shadow-[0_8px_24px_-8px_rgb(139_116_255/0.8)] [transform:perspective(300px)_rotateY(-14deg)_rotateX(6deg)]">V</span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[14px] font-semibold">VEDRA</span>
          <span className="block text-[12px] text-a-dim">{t("shell.storeAdmin")}</span>
        </span>
      </div>

      <nav className="a-scroll flex-1 overflow-y-auto px-2.5 pb-4" aria-label={t("shell.adminNav")}>
        <ul className="space-y-0.5">
          {NAV.map((sec) => {
            const active = sec.key === activeKey;
            const open = !!sec.children && isOpen(sec);
            const childSum = (sec.children ?? []).reduce((n, c) => n + (c.badge ? counts[c.badge] : 0), 0);
            const n = sec.badge ? counts[sec.badge] : !open ? childSum : 0;
            const tone = sec.badge ? toneOf(sec.badge) : (sec.children ?? []).some((c) => c.badge && toneOf(c.badge) === "accent" && counts[c.badge]) ? "accent" : "warn";
            const subId = `nav-sub-${sec.key}`;
            return (
              <li key={sec.key}>
                <div className="group/nav relative flex items-center">
                  <Link
                    href={sec.href}
                    onClick={() => {
                      if (sec.children) setToggled((t) => ({ ...t, [sec.key]: true }));
                      onNavigate?.();
                    }}
                    aria-current={active && !here?.leaf ? "page" : undefined}
                    className={cx("fx-spot fx-press relative flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-colors", active ? "text-a-text" : "text-a-dim hover:bg-a-ink/[0.035] hover:text-a-text", sec.children && "pe-9")}
                  >
                    {active ? <motion.span layoutId="side-active" className="absolute inset-0 rounded-[10px] bg-a-ink/[0.06] shadow-[0_6px_18px_-12px_var(--a-shadow)] ring-1 ring-inset ring-a-ink/[0.06]" transition={{ type: "spring", stiffness: 520, damping: 40 }} /> : null}
                    {active ? <motion.span layoutId="side-bar" className="absolute -start-2.5 top-2 h-5 w-[3px] rounded-e-full a-grad shadow-[0_0_12px_rgb(139_116_255/0.7)]" transition={{ type: "spring", stiffness: 520, damping: 40 }} /> : null}
                    <AIcon name={sec.icon} size={17} className={cx("relative shrink-0 transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover/nav:-translate-y-px group-hover/nav:scale-110 group-hover/nav:-rotate-6", active && "text-a-accent drop-shadow-[0_0_6px_rgb(139_116_255/0.55)]")} />
                    <span className={cx("relative truncate transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover/nav:translate-x-0.5 rtl:group-hover/nav:-translate-x-0.5", active && "font-medium")}>{t(sec.label)}</span>
                    {n ? <CountBadge n={n} tone={tone} /> : null}
                  </Link>
                  {sec.children ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={subId}
                      aria-label={t(open ? "shell.collapse" : "shell.expand", { section: t(sec.label) })}
                      onClick={() => setToggled((t) => ({ ...t, [sec.key]: !open }))}
                      className="absolute end-1 top-1/2 z-[1] grid size-7 -translate-y-1/2 place-items-center rounded-md text-a-faint transition hover:bg-a-ink/[0.06] hover:text-a-text"
                    >
                      <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", stiffness: 420, damping: 28 }} className="grid">
                        <AIcon name="chevronRight" size={14} className="rtl:-scale-x-100" />
                      </motion.span>
                    </button>
                  ) : null}
                </div>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.ul
                      id={subId}
                      key="sub"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ height: { type: "spring", stiffness: 420, damping: 38 }, opacity: { duration: 0.18 } }}
                      className="relative overflow-hidden"
                    >
                      <span aria-hidden className="absolute bottom-2 start-[18px] top-1 w-px bg-a-line" />
                      {sec.children!.map((leaf, i) => {
                        const on = here?.leaf === leaf;
                        const c = leaf.badge ? counts[leaf.badge] : 0;
                        return (
                          <motion.li key={leaf.href} initial={{ opacity: 0, x: isRtl ? 6 : -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease, delay: 0.03 * i }}>
                            <Link
                              href={leaf.href}
                              onClick={() => {
                                if (pathOf(leaf.href) === "/admin/settings") onSettingsTab?.(new URLSearchParams(leaf.href.split("?")[1] ?? "").get("tab") ?? "store");
                                onNavigate?.();
                              }}
                              aria-current={on ? "page" : undefined} className={cx("fx-press relative ms-[18px] flex h-8 items-center gap-2 rounded-[9px] ps-4 pe-2 text-[13px] transition-colors", on ? "font-medium text-a-text" : "text-a-dim hover:bg-a-ink/[0.035] hover:text-a-text")}>
                              {on ? <motion.span layoutId="side-leaf" className="absolute inset-0 rounded-[9px] bg-a-ink/[0.05]" transition={{ type: "spring", stiffness: 520, damping: 40 }} /> : null}
                              <span aria-hidden className={cx("absolute -start-[3px] top-1/2 size-[7px] -translate-y-1/2 rounded-full ring-2 ring-a-side transition-colors", on ? "bg-a-accent shadow-[0_0_8px_rgb(139_116_255/0.8)]" : "bg-a-line-strong")} />
                              <span className="relative truncate">{t(leaf.label)}</span>
                              {c ? <CountBadge n={c} tone={toneOf(leaf.badge)} /> : null}
                            </Link>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-a-line p-2.5">
        <a href="/" target="_blank" rel="noopener noreferrer" className="fx-press relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] text-a-dim transition hover:bg-a-ink/[0.035] hover:text-a-text">
          <AIcon name="store" size={17} /> {t("shell.viewStore")} <AIcon name="external" size={13} className="ms-auto rtl:-scale-x-100" />
        </a>
        <form action={logoutAction}>
          <button className="fx-press relative flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] text-a-dim transition hover:bg-a-ink/[0.035] hover:text-a-text">
            <AIcon name="logout" size={17} className="rtl:-scale-x-100" /> {t("shell.signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Breadcrumb() {
  const { t } = useT();
  const { path, here } = useLocation();
  const sec = here?.section ?? NAV[0];
  const leaf = here?.leaf;
  const crumbs: { label: string; href?: string }[] = [];
  if (sec.key !== "home") crumbs.push({ label: t(sec.label), href: sec.href });
  if (leaf && leaf.href !== sec.href) crumbs.push({ label: t(leaf.label), href: leaf.href });
  const deeper = !sec.exact && path !== pathOf(leaf?.href ?? sec.href);
  if (path === "/admin/orders/new") crumbs.push({ label: t("shell.createOrder") });
  else if (deeper) crumbs.push({ label: t("shell.details") });
  if (!crumbs.length) crumbs.push({ label: t("shell.nav.home") });
  return (
    <nav aria-label={t("shell.breadcrumb")} className="flex min-w-0 items-center gap-2 text-[13px]">
      <Link href="/admin" className="shrink-0 text-a-dim hover:text-a-text">
        {t("shell.dashboard")}
      </Link>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-2">
            <span className="text-a-faint" aria-hidden>/</span>
            {last || !c.href ? (
              <span className={cx("truncate", last && "font-medium")} aria-current={last ? "page" : undefined}>
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="truncate text-a-dim hover:text-a-text">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Clock() {
  const { t, fmt } = useT();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const i = setInterval(tick, 20_000);
    return () => clearInterval(i);
  }, []);
  return (
    <span className="hidden h-7 items-center gap-1 rounded-lg border border-a-line px-2.5 text-[12px] tabular-nums text-a-dim sm:inline-flex">
      <bdi dir="ltr">{now === null ? "--:--" : fmt.time(now)}</bdi> {t("shell.cairo")}
    </span>
  );
}

/* ───────────── ⌘K command palette ───────────── */

const ACTIONS: { href: string; label: AdminKey; keywords: AdminKey }[] = [
  { href: "/admin/products/new", label: "shell.cmd.addProduct", keywords: "shell.cmd.kwAddProduct" },
  { href: "/admin/orders/new", label: "shell.cmd.createOrder", keywords: "shell.cmd.kwCreateOrder" },
  { href: "/admin/categories", label: "shell.cmd.addCategory", keywords: "shell.cmd.kwAddCategory" },
];
/** Every page in the sidebar, flattened (section › leaf). */
const ALL_PAGES: { href: string; label: AdminKey; sub: AdminKey; icon: AIconName }[] = NAV.flatMap((sec) =>
  sec.children ? sec.children.map((c) => ({ href: c.href, label: c.label === "shell.nav.allOrders" || c.label === "shell.nav.allProducts" || c.label === "shell.nav.allCustomers" ? sec.label : c.label, sub: sec.label, icon: sec.icon })) : [{ href: sec.href, label: sec.label, sub: "shell.cmd.page" as AdminKey, icon: sec.icon }],
).filter((x, i, a) => a.findIndex((y) => y.href === x.href) === i && x.href !== "/admin/products/new");

function CommandPalette({ open, onClose, index }: { open: boolean; onClose: () => void; index: SearchIndex }) {
  const { t: tr, fmt } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panel, onClose);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setSel(0);
    }
  }

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    // match the current language and English, so "orders" still finds الطلبات
    const en = (k: AdminKey) => makeT("en")(k);
    const hit = (k: AdminKey) => !t || tr(k).toLowerCase().includes(t) || en(k).toLowerCase().includes(t);
    const statusLabel = (s: string) => tr(s === "active" || s === "draft" || s === "archived" ? (`common.${s}` as AdminKey) : "common.status");
    const pages = ALL_PAGES.filter((it) => hit(it.label) || hit(it.sub)).map((it) => ({ key: it.href, href: it.href, label: tr(it.label), sub: tr(it.sub), icon: it.icon, image: undefined as string | undefined }));
    const products = index.products.filter((p) => t && p.title.toLowerCase().includes(t)).slice(0, 5).map((p) => ({ key: `p${p.id}`, href: `/admin/products/${p.id}`, label: p.title, sub: tr("shell.cmd.product", { status: statusLabel(p.status) }), icon: "products" as AIconName, image: p.image }));
    const orders = index.orders.filter((o) => t && (o.number.toLowerCase().includes(t) || o.name.toLowerCase().includes(t))).slice(0, 5).map((o) => ({ key: `o${o.id}`, href: `/admin/orders/${o.id}`, label: `${o.number} · ${o.name}`, sub: tr("shell.cmd.order", { total: fmt.money(o.total) }), icon: "orders" as AIconName, image: undefined }));
    const actions = ACTIONS.filter((a) => hit(a.label) || tr(a.keywords).toLowerCase().includes(t)).map((a) => ({ key: `a${a.href}`, href: a.href, label: tr(a.label), sub: tr("shell.cmd.action"), icon: "plus" as AIconName, image: undefined }));
    return [...actions, ...products, ...orders, ...pages].slice(0, t ? 12 : 16);
  }, [q, index, tr, fmt]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[85] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={tr("shell.cmd.label")}>
          <motion.div className="absolute inset-0 bg-a-scrim/65" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.16 }} onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }} transition={{ duration: 0.2, ease }} style={{ transformOrigin: "50% 0" }} ref={panel} tabIndex={-1} className="relative w-full outline-none max-w-[600px] overflow-hidden rounded-2xl border border-a-line-strong bg-a-panel shadow-[0_40px_100px_-20px_var(--a-shadow)]">
            <div className="flex items-center gap-3 border-b border-a-line px-4">
              <AIcon name="search" size={17} className="text-a-faint" />
              <input
                ref={input}
                value={q}
                autoFocus
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
                  if (e.key === "Enter" && results[sel]) go(results[sel].href);
                }}
                placeholder={tr("shell.cmd.placeholder")}
                className="h-13 flex-1 bg-transparent py-4 text-[14.5px] outline-none placeholder:text-a-faint"
              />
              <Kbd>esc</Kbd>
            </div>
            <ul className="a-scroll max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 ? <li className="px-3 py-8 text-center text-[13px] text-a-dim">{tr("common.noResultsFor", { q })}</li> : null}
              {results.map((r, i) => (
                <li key={r.key}>
                  <button onMouseEnter={() => setSel(i)} onClick={() => go(r.href)} className={cx("relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start", i === sel && "text-a-text")}>
                    {i === sel ? <motion.span layoutId="cmd-sel" className="absolute inset-0 rounded-xl bg-a-ink/[0.06]" transition={{ type: "spring", stiffness: 600, damping: 42 }} /> : null}
                    <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-a-line bg-a-panel-2 text-a-dim">
                      {r.image ? <Image src={r.image} alt="" fill sizes="32px" className="object-cover" /> : <AIcon name={r.icon} size={15} />}
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{r.label}</span>
                      <span className="block truncate text-[12px] text-a-faint">{r.sub}</span>
                    </span>
                    {i === sel ? <AIcon name="chevronRight" size={15} className="relative text-a-faint rtl:rotate-180" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/* ───────────── Theme switch: sun / moon / monitor with a sliding indicator ───────────── */

const THEME_OPTS: { value: AdminTheme; label: AdminKey; icon: AIconName }[] = [
  { value: "light", label: "shell.theme.light", icon: "sun" },
  { value: "dark", label: "shell.theme.dark", icon: "moon" },
  { value: "system", label: "shell.theme.system", icon: "monitor" },
];

function ThemeSwitch() {
  const { t } = useT();
  const { theme, setTheme } = useAdminTheme();
  return (
    <div role="radiogroup" aria-label={t("shell.theme.label")} className="relative flex h-8 items-center gap-0.5 rounded-lg border border-a-line bg-a-panel p-0.5">
      {THEME_OPTS.map((o) => {
        const on = theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            aria-label={t(o.label)}
            title={t(o.label)}
            onClick={(e) => setTheme(o.value, e.detail ? { x: e.clientX, y: e.clientY } : undefined)}
            className={cx("fx-press relative grid h-full w-7 place-items-center rounded-md transition-colors", on ? "text-a-text" : "text-a-faint hover:text-a-text")}
          >
            {on ? <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-md bg-a-hover shadow-[0_2px_8px_-4px_var(--a-shadow)] ring-1 ring-a-line-strong" transition={{ type: "spring", stiffness: 520, damping: 36 }} /> : null}
            <motion.span key={on ? "on" : "off"} className="relative" initial={on ? { rotate: -60, scale: 0.6 } : false} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 20 }}>
              <AIcon name={o.icon} size={14} />
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── keyboard shortcuts ───────────── */

const SEQUENCES: Record<string, string> = {
  "g h": "/admin",
  "g o": "/admin/orders",
  "g p": "/admin/products",
  "g c": "/admin/customers",
  "g a": "/admin/analytics",
  "g s": "/admin/settings",
  "n p": "/admin/products/new",
  "n o": "/admin/orders/new",
};
const SHORTCUTS: { keys: string[][]; label: AdminKey }[] = [
  { keys: [["⌘", "K"]], label: "shell.shortcuts.search" },
  { keys: [["⌘", "S"]], label: "shell.shortcuts.save" },
  { keys: [["G"], ["O"]], label: "shell.shortcuts.goOrders" },
  { keys: [["G"], ["P"]], label: "shell.shortcuts.goProducts" },
  { keys: [["G"], ["C"]], label: "shell.shortcuts.goCustomers" },
  { keys: [["G"], ["H"]], label: "shell.shortcuts.goHome" },
  { keys: [["N"], ["P"]], label: "shell.shortcuts.newProduct" },
  { keys: [["N"], ["O"]], label: "shell.shortcuts.createOrder" },
  { keys: [["?"]], label: "shell.shortcuts.help" },
  { keys: [["Esc"]], label: "shell.shortcuts.esc" },
];

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onClose} title={t("shell.shortcuts.title")} description={t("shell.shortcuts.description")} width="max-w-md">
      <ul className="grid gap-1">
        {SHORTCUTS.map((s, i) => (
          <motion.li key={s.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease, delay: 0.025 * i }} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 text-[13.5px] hover:bg-a-ink/[0.035]">
            <span className="text-a-dim">{t(s.label)}</span>
            <span className="flex items-center gap-1.5" dir="ltr">
              {s.keys.map((combo, j) => (
                <span key={j} className="flex items-center gap-0.5">
                  {j ? <span className="me-1 text-[11px] text-a-faint">{t("shell.shortcuts.then")}</span> : null}
                  {combo.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              ))}
            </span>
          </motion.li>
        ))}
      </ul>
    </Modal>
  );
}

/**
 * Marks the first ~0.8s after a page mounts (data-a-entering): the dashboard image bloom is scoped to it,
 * so images that mount later (filters, pagination, drawers, router.refresh) appear without replaying it.
 */
function EnterSettle({ children }: { children: React.ReactNode }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setEntering(false), 800);
    return () => clearTimeout(id);
  }, []);
  return (
    <div data-a-entering={entering ? "" : undefined} className="contents">
      {children}
    </div>
  );
}

export function AdminShell({ counts, index, children }: { counts: ShellCounts; index: SearchIndex; children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [help, setHelp] = useState(false);
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const main = useRef<HTMLElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const { t, isRtl: rtl } = useT();
  useDialogFocus(menu, drawer, () => setMenu(false));

  // Settings keeps its own tab state (shallow URL updates). When a sidebar settings link is clicked,
  // remount the page once the new ?tab= arrives so it opens on that tab.
  const tab = path === "/admin/settings" ? (params.get("tab") ?? "store") : "";
  const [tabNav, setTabNav] = useState<{ want: boolean; tab: string; n: number }>({ want: false, tab, n: 0 });
  if (tabNav.want && tab !== tabNav.tab) setTabNav({ want: false, tab, n: tabNav.n + 1 });
  const pageKey = path === "/admin/settings" ? `${path}#${tabNav.n}` : path;

  useEffect(() => {
    let prefix = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || typing(e.target) || document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (prefix) {
        const href = SEQUENCES[`${prefix} ${key}`];
        prefix = "";
        clearTimeout(timer);
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      if (key === "g" || key === "n") {
        prefix = key;
        timer = setTimeout(() => (prefix = ""), 1200);
      }
    };
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("keydown", k);
      clearTimeout(timer);
    };
  }, [router]);
  // new page → scroll the content pane back to top
  useEffect(() => {
    // block body: newer Chrome returns a Promise from scrollTo, which must not be the effect cleanup
    main.current?.scrollTo({ top: 0 });
  }, [path]);

  return (
    <div className="flex h-full">
      <FxRuntime />
      <aside className="hidden w-[248px] shrink-0 border-e border-a-line bg-a-side md:block">
        <Sidebar counts={counts} onSettingsTab={(to) => to !== tab && setTabNav((t) => ({ ...t, want: true }))} />
      </aside>

      <AnimatePresence>
        {menu ? (
          <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label={t("shell.openMenu")}>
            <motion.div className="absolute inset-0 bg-a-scrim/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
            <motion.aside ref={drawer} tabIndex={-1} initial={{ x: rtl ? 280 : -280 }} animate={{ x: 0 }} exit={{ x: rtl ? 280 : -280, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }} transition={{ type: "spring", stiffness: 420, damping: 40 }} className="absolute inset-y-0 start-0 w-[272px] border-e border-a-line bg-a-side outline-none">
              <Sidebar counts={counts} onNavigate={() => setMenu(false)} onSettingsTab={(to) => to !== tab && setTabNav((t) => ({ ...t, want: true }))} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-a-line bg-a-bg px-4 md:px-7">
          <button onClick={() => setMenu(true)} aria-label={t("shell.openMenu")} className="-ms-1 grid size-9 place-items-center rounded-lg text-a-dim hover:bg-a-panel-2 hover:text-a-text md:hidden">
            <AIcon name="menu" size={18} className="rtl:-scale-x-100" />
          </button>
          <Breadcrumb />
          <div className="ms-auto flex items-center gap-2">
            <button onClick={() => setCmd(true)} className="fx-press relative flex h-8 items-center gap-2 rounded-lg border border-a-line bg-a-panel px-2.5 text-[12.5px] text-a-dim transition hover:border-a-line-strong hover:text-a-text">
              <AIcon name="search" size={14} />
              <span className="hidden sm:inline">{t("shell.searchBtn")}</span>
              <span className="hidden items-center gap-0.5 sm:flex" dir="ltr">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <button onClick={() => setHelp(true)} aria-label={t("shell.shortcutsBtn")} title={t("shell.shortcutsTitle")} className="fx-press hidden size-8 place-items-center rounded-lg border border-a-line bg-a-panel text-[13px] font-semibold text-a-dim transition hover:border-a-line-strong hover:text-a-text sm:grid">
              ?
            </button>
            <LangSwitch />
            <ThemeSwitch />
            <span className="hidden h-7 items-center gap-1.5 rounded-lg border border-a-line px-2.5 text-[12px] text-a-dim xl:inline-flex">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-a-ok/70" />
                <span className="relative size-1.5 rounded-full bg-a-ok" />
              </span>
              {t("shell.storeLive")}
            </span>
            <span className="hidden h-7 items-center rounded-lg border border-a-line px-2.5 text-[12px] text-a-dim lg:inline-flex">
              {t("shell.today")} <b className="mx-1.5 font-semibold tabular-nums text-a-text">{counts.todayOrders}</b>
              {t("shell.ordersWord", { count: counts.todayOrders })}
            </span>
            <Clock />
          </div>
        </header>

        <main ref={main} className="a-scroll relative flex-1 overflow-y-auto">
          {/* CSS rise + fade enter, once per path per session, and a quick VT dissolve on leave (fx/page-transition). Keyed per route so
              the settings sidebar tab links still remount the page — a seen path never replays the enter. */}
          <PageTransition key={pageKey} variant="admin" className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-7 md:px-8 md:pt-9">
            <EnterSettle>{children}</EnterSettle>
          </PageTransition>
        </main>
      </div>

      <CommandPalette open={cmd} onClose={() => setCmd(false)} index={index} />
      <ShortcutsModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
