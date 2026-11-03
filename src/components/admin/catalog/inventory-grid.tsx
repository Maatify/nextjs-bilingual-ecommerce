"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { saveVariantStock, type VariantStockChange } from "@/app/admin/(panel)/inventory/actions";
import { cx } from "@/lib/format";
import type { ProductStatus } from "@/lib/types";
import { useT } from "../i18n";
import { AIcon } from "../icons";
import { Badge, Button, EmptyState, Input, PageHeader, SaveBar, Select, Stat, Stagger, StaggerItem, Tabs, ease, toast, useDraft } from "../ui";
import { LOW_STOCK, Thumb, statusTone } from "./shared";
import { Stepper } from "./sizes-editor";

export interface InventoryItem {
  id: string;
  title: string;
  image: string;
  status: ProductStatus;
  sku?: string;
  category: string;
  tracked: boolean;
  colors: { name: string; hex: string; image: string }[];
  variants: { color: string; size: string; stock: number; sku?: string }[];
}

type StockFilter = "all" | "low" | "out";
const SEP = "\u0001";
const keyOf = (id: string, color: string, size: string) => `${id}${SEP}${color}${SEP}${size}`;

/** Inventory per variant (product › colour › size), Shopify-style, with bulk adjust and one save. */
export function InventoryGrid({ items }: { items: InventoryItem[] }) {
  const { t: tr, isRtl } = useT();
  const router = useRouter();
  const saved = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of items) if (p.tracked) for (const v of p.variants) m[keyOf(p.id, v.color, v.size)] = v.stock;
    return m;
  }, [items]);
  const [draft, setDraft, dirty, discard] = useDraft(saved);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [stockF, setStockF] = useState<StockFilter>("all");
  const [productF, setProductF] = useState("all");
  const [colourF, setColourF] = useState("all");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [delta, setDelta] = useState("5");

  const colourNames = useMemo(() => [...new Set(items.flatMap((p) => p.colors.map((c) => c.name)))].sort(), [items]);

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items
      .filter((p) => (productF === "all" || p.id === productF) && (status === "all" || p.status === status))
      .map((p) => {
        const hitProduct = !t || p.title.toLowerCase().includes(t) || (p.sku ?? "").toLowerCase().includes(t) || p.category.toLowerCase().includes(t);
        const rows = p.variants.filter((v) => {
          if (colourF !== "all" && v.color !== colourF) return false;
          if (!hitProduct && !`${v.color} ${v.size} ${v.sku ?? ""}`.toLowerCase().includes(t)) return false;
          if (stockF !== "all") {
            if (!p.tracked) return false;
            // filter on the SAVED stock (and keep rows being edited): filtering on the draft made a row vanish
            // mid-edit (e.g. typing 5 into a sold-out cell under "Out of stock"), dropping focus
            const k = keyOf(p.id, v.color, v.size);
            const n = saved[k] ?? 0;
            if (draft[k] === n && (stockF === "out" ? n !== 0 : n > LOW_STOCK)) return false;
          }
          return true;
        });
        return { p, rows };
      })
      .filter((g) => g.rows.length);
  }, [items, q, productF, colourF, stockF, status, draft, saved]);

  const stats = useMemo(() => {
    let units = 0,
      out = 0,
      low = 0;
    for (const p of items) {
      if (p.status === "archived" || !p.tracked) continue;
      for (const v of p.variants) {
        const n = draft[keyOf(p.id, v.color, v.size)] ?? 0;
        units += n;
        if (n === 0) out++;
        else if (n <= LOW_STOCK) low++;
      }
    }
    return { units, out, low };
  }, [items, draft]);

  const changes = useMemo(() => {
    const list: VariantStockChange[] = [];
    for (const [k, n] of Object.entries(draft))
      if (saved[k] !== n) {
        const [productId, color, size] = k.split(SEP);
        list.push({ productId, color, size, stock: n });
      }
    return list;
  }, [draft, saved]);

  const shownKeys = useMemo(() => groups.flatMap((g) => (g.p.tracked ? g.rows.map((v) => keyOf(g.p.id, v.color, v.size)) : [])), [groups]);
  const selShown = shownKeys.filter((k) => sel.has(k));
  const scope = selShown.length ? selShown : shownKeys;
  const allOn = shownKeys.length > 0 && selShown.length === shownKeys.length;

  const setCell = (k: string, n: number) => setDraft((d) => ({ ...d, [k]: n }));
  const toggle = (keys: string[], on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      keys.forEach((k) => (on ? n.add(k) : n.delete(k)));
      return n;
    });

  const bulk = (mode: "adjust" | "set") => {
    const n = Math.round(Number(delta) || 0);
    if (mode === "adjust" && !n) return toast.info(tr("catalog.inventory.enterNumber"), tr("catalog.inventory.enterNumberHint"));
    setDraft((d) => {
      const next = { ...d };
      for (const k of scope) next[k] = Math.max(0, Math.min(1_000_000, mode === "adjust" ? (d[k] ?? 0) + n : Math.max(0, n)));
      return next;
    });
    toast.info(mode === "adjust" ? tr("catalog.inventory.adjusted", { n: `${n > 0 ? "+" : ""}${n}`, count: scope.length }) : tr("catalog.inventory.setTo", { count: scope.length, n: Math.max(0, n) }), tr("catalog.inventory.review"));
  };

  const save = async () => {
    if (!changes.length) return;
    setSaving(true);
    const res = await saveVariantStock(changes);
    setSaving(false);
    if (!res.ok) return toast.error(tr("catalog.inventory.saveFailed"), res.error);
    toast.success(tr("catalog.inventory.saved"), tr("catalog.inventory.savedBody", { count: res.data ?? changes.length }));
    setSel(new Set());
    router.refresh();
  };

  const filtered = q || stockF !== "all" || productF !== "all" || colourF !== "all" || status !== "all";

  return (
    <>
      <PageHeader title={tr("catalog.inventory.title")} description={tr("catalog.inventory.description")} />

      <Stagger className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StaggerItem>
          <Stat label={tr("catalog.inventory.units")} value={stats.units} icon="inventory" />
        </StaggerItem>
        <StaggerItem>
          <Stat label={tr("catalog.inventory.lowVariants", { n: LOW_STOCK })} value={stats.low} icon="alert" tone="#fb923c" />
        </StaggerItem>
        <StaggerItem>
          <Stat label={tr("catalog.inventory.soldOutVariants")} value={stats.out} icon="close" tone="#f87171" />
        </StaggerItem>
      </Stagger>

      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Tabs<StockFilter>
          value={stockF}
          onChange={setStockF}
          items={[
            { value: "all", label: tr("common.all") },
            { value: "low", label: tr("catalog.inventory.lowStock"), count: stats.low },
            { value: "out", label: tr("catalog.inventory.soldOut"), count: stats.out },
          ]}
        />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-[240px]">
            <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
            <Input aria-label={tr("catalog.inventory.search")} placeholder={tr("catalog.inventory.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
          </div>
          <Select aria-label={tr("catalog.list.cols.product")} value={productF} onChange={(e) => setProductF(e.target.value)} className="w-[170px]">
            <option value="all">{tr("catalog.inventory.allProducts")}</option>
            {items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("catalog.inventory.colour")} value={colourF} onChange={(e) => setColourF(e.target.value)} className="w-[150px]">
            <option value="all">{tr("catalog.inventory.allColours")}</option>
            {colourNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("common.status")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-[130px]">
            <option value="all">{tr("catalog.inventory.anyStatus")}</option>
            <option value="active">{tr("catalog.status.active")}</option>
            <option value="draft">{tr("catalog.status.draft")}</option>
            <option value="archived">{tr("catalog.status.archived")}</option>
          </Select>
          {filtered ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ("");
                setStockF("all");
                setProductF("all");
                setColourF("all");
                setStatus("all");
              }}
            >
              {tr("common.clear")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* bulk bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-a-line bg-a-panel px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-a-dim">
          <input type="checkbox" checked={allOn} onChange={(e) => toggle(shownKeys, e.target.checked)} aria-label={tr("catalog.inventory.selectShown")} className="size-4 accent-[var(--color-a-violet)]" />
          {selShown.length ? tr("common.selected", { count: selShown.length }) : tr("catalog.inventory.shown", { count: shownKeys.length })}
        </label>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-a-faint">{selShown.length ? tr("catalog.inventory.scopeSelected") : tr("catalog.inventory.scopeShown")}</span>
          <Input aria-label={tr("catalog.list.bulk.amount")} type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className="w-20" />
          <Button size="sm" icon="plus" onClick={() => bulk("adjust")} disabled={!scope.length}>
            {tr("catalog.inventory.adjust")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => bulk("set")} disabled={!scope.length}>
            {tr("catalog.inventory.set")}
          </Button>
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-a-line bg-a-panel">
        {!groups.length ? (
          <EmptyState
            icon={stockF !== "all" ? "check" : "search"}
            title={stockF === "out" ? tr("catalog.inventory.noneOut") : stockF === "low" ? tr("catalog.inventory.noneLow") : tr("catalog.inventory.noMatch")}
            description={stockF !== "all" ? tr("catalog.inventory.allAbove", { n: stockF === "out" ? 0 : LOW_STOCK }) : tr("catalog.inventory.noMatchBody")}
          />
        ) : (
          <div>
            <div className="hidden grid-cols-[28px_minmax(0,1fr)_140px_150px] items-center gap-3 border-b border-a-line px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-a-faint md:grid">
              <span />
              <span>{tr("catalog.inventory.variant")}</span>
              <span>SKU</span>
              <span className="text-end">{tr("catalog.inventory.available")}</span>
            </div>
            {groups.map(({ p, rows }) => {
              const open = !collapsed.has(p.id);
              const keys = p.tracked ? rows.map((v) => keyOf(p.id, v.color, v.size)) : [];
              const total = keys.reduce((n, k) => n + (draft[k] ?? 0), 0);
              const pending = keys.filter((k) => draft[k] !== saved[k]).length;
              const groupOn = keys.length > 0 && keys.every((k) => sel.has(k));
              return (
                <section key={p.id} className="border-b border-a-line last:border-0">
                  <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 bg-a-panel-2/40 px-4 py-2.5 md:grid-cols-[28px_minmax(0,1fr)_140px_150px]">
                    <input type="checkbox" disabled={!keys.length} checked={groupOn} onChange={(e) => toggle(keys, e.target.checked)} aria-label={tr("catalog.inventory.selectProduct", { title: p.title })} className="size-4 accent-[var(--color-a-violet)] disabled:opacity-30" />
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() =>
                        setCollapsed((s) => {
                          const n = new Set(s);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                      className="flex min-w-0 items-center gap-3 text-start"
                    >
                      <Thumb src={p.image} className="h-11 w-9 ring-1 ring-a-line" sizes="36px" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium">{p.title}</span>
                          {p.status !== "active" ? <Badge tone={statusTone[p.status]}>{tr(`catalog.status.${p.status}`)}</Badge> : null}
                          {pending ? <Badge tone="violet">{tr("catalog.inventory.unsaved", { count: pending })}</Badge> : null}
                        </span>
                        <span className="text-[11.5px] text-a-faint">
                          {tr("catalog.inventory.variants", { count: rows.length })} · {p.category}
                        </span>
                      </span>
                      <AIcon name="chevronDown" size={14} className={cx("shrink-0 text-a-faint transition-transform duration-200", !open && "-rotate-90 rtl:rotate-90")} />
                    </button>
                    <Link href={`/admin/products/${p.id}`} className="hidden text-[12px] text-a-accent hover:underline md:block">
                      {tr("catalog.inventory.editProduct")}
                    </Link>
                    <span className={cx("text-end text-[13px] font-medium tabular-nums", !p.tracked ? "text-a-faint" : total === 0 ? "text-a-danger" : "")}>{p.tracked ? total.toLocaleString("en") : tr("catalog.inventory.notTracked")}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                        {rows.map((v, i) => {
                          const k = keyOf(p.id, v.color, v.size);
                          const n = draft[k] ?? 0;
                          const changed = p.tracked && saved[k] !== n;
                          const c = p.colors.find((x) => x.name === v.color);
                          const newColour = i === 0 || rows[i - 1].color !== v.color;
                          return (
                            <div
                              key={k}
                              className={cx(
                                "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-1.5 transition-colors md:grid-cols-[28px_minmax(0,1fr)_140px_150px]",
                                newColour && "border-t border-a-line/60",
                                sel.has(k) && "bg-a-violet/[0.05]",
                              )}
                            >
                              <input type="checkbox" disabled={!p.tracked} checked={sel.has(k)} onChange={(e) => toggle([k], e.target.checked)} aria-label={tr("catalog.list.selectOne", { title: `${p.title} ${v.color} ${v.size}` })} className="size-4 accent-[var(--color-a-violet)] disabled:opacity-30" />
                              <span className="flex min-w-0 items-center gap-2.5 ps-2 md:ps-12">
                                {newColour ? <Thumb src={c?.image} className="size-7 ring-1 ring-a-line" sizes="28px" rounded="rounded-md" /> : <span className="size-7 shrink-0" />}
                                <span className="flex min-w-0 items-center gap-1.5 text-[13px]">
                                  <span className="size-2.5 shrink-0 rounded-full ring-1 ring-a-ink/15" style={{ background: c?.hex }} />
                                  <span className="truncate text-a-dim">{v.color}</span>
                                  <AIcon name="chevronRight" size={12} className="shrink-0 text-a-faint rtl:rotate-180" />
                                  <span className="font-medium">{v.size}</span>
                                </span>
                                {p.tracked && n === 0 ? <Badge tone="red">{tr("catalog.inventory.soldOut")}</Badge> : p.tracked && n <= LOW_STOCK ? <Badge tone="amber">{tr("catalog.inventory.low")}</Badge> : null}
                              </span>
                              <span dir="ltr" className="hidden truncate text-start font-mono text-[11.5px] text-a-faint md:block rtl:text-end">{v.sku ?? (p.sku ? `${p.sku}` : "—")}</span>
                              <span className="flex items-center justify-end gap-2">
                                {changed ? (
                                  <motion.span initial={{ opacity: 0, x: isRtl ? -4 : 4 }} animate={{ opacity: 1, x: 0 }} className="text-[11px] tabular-nums text-a-faint" title={tr("catalog.inventory.savedValue")}>
                                    <s>{saved[k]}</s>
                                  </motion.span>
                                ) : null}
                                {p.tracked ? (
                                  <span className={cx("rounded-[12px] p-0.5 transition-colors", changed ? "bg-a-violet/15" : n === 0 ? "bg-a-danger/12" : n <= LOW_STOCK ? "bg-a-warn/10" : "")}>
                                    <Stepper compact label={tr("catalog.inventory.stockOf", { name: `${p.title} ${v.color} ${v.size}` })} value={n} onChange={(x) => setCell(k, x)} />
                                  </span>
                                ) : (
                                  <span className="text-[12px] text-a-faint">{tr("catalog.inventory.notTracked")}</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} label={tr("catalog.inventory.unsavedChanges", { count: changes.length })} />
    </>
  );
}
