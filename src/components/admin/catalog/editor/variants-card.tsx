"use client";

import { AnimatePresence, Reorder, motion } from "motion/react";
import { useMemo, useState } from "react";
import { cx, money } from "@/lib/format";
import type { ColorVariant, Product, ProductVariant } from "@/lib/types";
import { isTracked, normalizeVariants } from "@/lib/variants";
import { AIcon } from "../../icons";
import { useT } from "../../i18n";
import { Badge, Button, IconBtn, Input, ease } from "../../ui";
import { COLOUR_PRESETS } from "../colour-media";
import { useStableKeys, permute } from "../keys";
import { LOW_STOCK, SortableItem, Thumb, move } from "../shared";
import { Stepper } from "../sizes-editor";

const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "XS–XXL", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "S–XL", sizes: ["S", "M", "L", "XL"] },
  { label: "Waist 28–36", sizes: ["28", "30", "32", "34", "36"] },
  { label: "One size", sizes: ["One size"] },
];
const HEX = /^#[0-9a-f]{6}$/i;
const lc = (s: string) => s.trim().toLowerCase();

/**
 * Rebuild the colour × size grid after the options changed. `renames` carries option
 * value renames (old → new) so existing variants keep their stock/price/SKU.
 */
export function withOptions(p: Product, colors: ColorVariant[], sizeLabels: string[], renames: { color?: [string, string]; size?: [string, string] } = {}): Product {
  const variants = (p.variants ?? []).map((v) => ({
    ...v,
    color: renames.color && lc(v.color) === lc(renames.color[0]) ? renames.color[1] : v.color,
    size: renames.size && lc(v.size) === lc(renames.size[0]) ? renames.size[1] : v.size,
  }));
  // keep the Arabic colour-name translation attached to a renamed colour (keyed by the English name)
  let ar = p.ar;
  if (renames.color && ar?.colors?.[renames.color[0]] !== undefined && renames.color[0] !== renames.color[1]) {
    const next = { ...ar.colors };
    next[renames.color[1]] = next[renames.color[0]];
    delete next[renames.color[0]];
    ar = { ...ar, colors: next };
  }
  return normalizeVariants({ ...p, ar, colors, sizes: sizeLabels.map((label) => ({ label, stock: 0 })), variants });
}

/* ───────────────────────── options ───────────────────────── */

function ColourOption({ p, onChange }: { p: Product; onChange: (p: Product) => void }) {
  const { t } = useT();
  const k = useStableKeys(p.colors.length);
  const [presetsFor, setPresetsFor] = useState<string | null>(null);
  const sizes = p.sizes.map((s) => s.label);

  const update = (i: number, patch: Partial<ColorVariant>) => {
    const old = p.colors[i];
    const colors = p.colors.map((c, j) => (j === i ? { ...c, ...patch } : c));
    onChange(withOptions(p, colors, sizes, patch.name !== undefined ? { color: [old.name, patch.name] } : {}));
  };
  const add = () => {
    const used = new Set(p.colors.map((c) => lc(c.name)));
    const preset = COLOUR_PRESETS.find((x) => !used.has(lc(x.name))) ?? { name: `Colour ${p.colors.length + 1}`, hex: "#888888" };
    k.add();
    onChange(withOptions(p, [...p.colors, { name: preset.name, hex: preset.hex, images: [] }], sizes));
  };

  return (
    <div>
      <Reorder.Group
        as="div"
        axis="y"
        values={k.keys}
        onReorder={(next: string[]) => {
          onChange(withOptions(p, permute(p.colors, k.keys, next), sizes));
          k.set(next);
        }}
        className="space-y-1.5"
      >
        <AnimatePresence initial={false}>
          {p.colors.map((c, i) => {
            const key = k.keys[i];
            const badHex = !HEX.test(c.hex);
            return (
              <SortableItem
                key={key}
                value={key}
                index={i}
                count={p.colors.length}
                label={t("products.variants.dragColour")}
                onMove={(from, to) => {
                  onChange(withOptions(p, move(p.colors, from, to), sizes));
                  k.set(move(k.keys, from, to));
                }}
                className="rounded-xl"
              >
                {(handle) => (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="rounded-xl bg-a-panel-2/60 p-1.5 ring-1 ring-a-line">
                    <div className="flex items-center gap-2">
                      {handle}
                      <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-[9px] ring-1 ring-a-line-strong transition hover:ring-a-accent" style={{ background: badHex ? "transparent" : c.hex }} title={t("products.variants.pickColour")}>
                        <input type="color" aria-label={t("products.variants.swatchFor", { name: c.name || t("products.media.colour") })} value={badHex ? "#888888" : c.hex} onChange={(e) => update(i, { hex: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                      </label>
                      <Input aria-label={t("products.variants.colourNAria", { n: i + 1 })} value={c.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={t("products.variants.colourName")} className="min-w-0 flex-1" />
                      <Input dir="ltr" aria-label={t("products.variants.colourHexAria", { n: i + 1 })} value={c.hex} onChange={(e) => update(i, { hex: e.target.value.trim() })} className={cx("hidden w-[92px] font-mono text-[12px] sm:block", badHex && "border-a-danger")} maxLength={7} />
                      <IconBtn icon="palette" label={t("products.variants.presets")} aria-expanded={presetsFor === key} onClick={() => setPresetsFor((x) => (x === key ? null : key))} className={presetsFor === key ? "bg-a-hover text-a-text" : ""} />
                      <IconBtn
                        icon="trash"
                        label={t("products.variants.removeX", { name: c.name || t("products.media.colour") })}
                        disabled={p.colors.length <= 1}
                        onClick={() => {
                          k.remove(i);
                          onChange(withOptions(p, p.colors.filter((_, j) => j !== i), sizes));
                        }}
                        className="hover:text-a-danger disabled:opacity-30"
                      />
                    </div>
                    <AnimatePresence initial={false}>
                      {presetsFor === key ? (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden">
                          <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2.5">
                            {COLOUR_PRESETS.map((x) => (
                              <button
                                key={x.name}
                                type="button"
                                onClick={() => {
                                  const keepName = c.name.trim() && !COLOUR_PRESETS.some((y) => y.name === c.name) && !/^Colour \d+$/.test(c.name);
                                  update(i, keepName ? { hex: x.hex } : { hex: x.hex, name: x.name });
                                  setPresetsFor(null);
                                }}
                                className={cx("flex h-7 items-center gap-1.5 rounded-full bg-a-ink/[0.04] ps-1 pe-2.5 text-[12px] text-a-dim ring-1 ring-a-line transition hover:text-a-text hover:ring-a-line-strong", c.hex.toLowerCase() === x.hex && "text-a-text ring-a-violet/50")}
                              >
                                <span className="size-5 rounded-full ring-1 ring-a-ink/15" style={{ background: x.hex }} />
                                {x.name}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                )}
              </SortableItem>
            );
          })}
        </AnimatePresence>
      </Reorder.Group>
      <button type="button" onClick={add} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-a-accent transition hover:bg-a-violet/10">
        <AIcon name="plus" size={14} /> {t("products.variants.addColour")}
      </button>
    </div>
  );
}

function SizeOption({ p, onChange }: { p: Product; onChange: (p: Product) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const labels = p.sizes.map((s) => s.label);
  const set = (next: string[], rename?: [string, string]) => onChange(withOptions(p, p.colors, next, rename ? { size: rename } : {}));
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim().slice(0, 20)).filter(Boolean);
    const next = [...labels];
    for (const x of parts) if (!next.some((l) => lc(l) === lc(x))) next.push(x);
    if (next.length !== labels.length) set(next);
    setDraft("");
  };

  return (
    <div>
      <Reorder.Group as="div" axis="x" values={labels} onReorder={(next: string[]) => set(next)} className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {labels.map((l, i) => (
            <Reorder.Item
              as="div"
              key={l}
              value={l}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileDrag={{ scale: 1.06, zIndex: 5 }}
              className="group flex h-8 cursor-grab items-center rounded-full bg-a-panel-2 ps-1 pe-1 ring-1 ring-a-line transition hover:ring-a-line-strong active:cursor-grabbing"
            >
              <input
                aria-label={t("products.variants.sizeN", { n: i + 1 })}
                defaultValue={l}
                size={Math.max(2, l.length)}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const v = e.target.value.trim().slice(0, 20);
                  if (!v || labels.some((x, j) => j !== i && lc(x) === lc(v))) e.target.value = l;
                  else if (v !== l) set(labels.map((x, j) => (j === i ? v : x)), [l, v]);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLInputElement).blur())}
                className="h-6 rounded-full bg-transparent px-2 text-center text-[12.5px] font-medium outline-none focus:bg-a-panel focus:ring-1 focus:ring-a-violet/50"
              />
              <button
                type="button"
                aria-label={t("products.variants.removeSize", { size: l })}
                disabled={labels.length <= 1}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => set(labels.filter((_, j) => j !== i))}
                className="grid size-6 place-items-center rounded-full text-a-faint transition hover:bg-a-danger/10 hover:text-a-danger disabled:opacity-30"
              >
                <AIcon name="close" size={11} />
              </button>
            </Reorder.Item>
          ))}
        </AnimatePresence>
        <div className="flex h-8 items-center rounded-full border border-dashed border-a-line-strong ps-2.5 pe-1 has-[input:focus]:border-a-violet/60">
          <input
            aria-label={t("products.variants.addSize")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder={t("products.variants.addSizePh")}
            className="h-6 w-[88px] bg-transparent text-[12.5px] outline-none placeholder:text-a-faint"
          />
          <button type="button" aria-label={t("products.variants.addSize")} onClick={add} disabled={!draft.trim()} className="grid size-6 place-items-center rounded-full text-a-accent transition hover:bg-a-violet/10 disabled:opacity-30">
            <AIcon name="plus" size={13} />
          </button>
        </div>
      </Reorder.Group>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="me-1 text-[11.5px] text-a-faint">{t("products.variants.presetsLabel")}</span>
        {SIZE_PRESETS.map((x) => (
          <button key={x.label} type="button" onClick={() => set(x.sizes)} className="h-6 rounded-full bg-a-ink/[0.04] px-2.5 text-[11.5px] text-a-dim ring-1 ring-a-line transition hover:text-a-text hover:ring-a-line-strong active:scale-95">
            {x.label === "Waist 28–36" ? t("products.variants.presetWaist") : x.label === "One size" ? t("products.variants.presetOne") : <bdi dir="ltr">{x.label}</bdi>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── variant table ───────────────────────── */

type Bulk = null | "stock" | "price";

export function VariantsCard({ p, onChange, error }: { p: Product; onChange: (p: Product) => void; error?: string | null }) {
  const { t } = useT();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<Bulk>(null);
  const [bulkVal, setBulkVal] = useState("");
  const [editing, setEditing] = useState<"colour" | "size" | null>(null);
  const tracked = isTracked(p);
  const variants = useMemo(() => p.variants ?? [], [p.variants]);
  const groups = useMemo(() => p.colors.map((c) => ({ color: c, rows: variants.filter((v) => v.color === c.name) })), [p.colors, variants]);
  const total = variants.reduce((n, v) => n + v.stock, 0);
  const validSel = [...sel].filter((id) => variants.some((v) => v.id === id));
  const scope = validSel.length ? validSel : variants.map((v) => v.id);

  const patch = (ids: string[], fn: (v: ProductVariant) => ProductVariant) => {
    const set = new Set(ids);
    onChange(normalizeVariants({ ...p, variants: variants.map((v) => (set.has(v.id) ? fn(v) : v)) }));
  };
  const toggle = (ids: string[], on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  const applyBulk = () => {
    const raw = bulkVal.trim();
    if (bulk === "stock") {
      const n = Math.max(0, Math.min(1_000_000, Math.round(Number(raw) || 0)));
      patch(scope, (v) => ({ ...v, stock: n }));
    } else if (bulk === "price") {
      const n = Number(raw);
      // empty = back to the product price
      patch(scope, (v) => ({ ...v, price: raw === "" || !(n > 0) ? undefined : Math.round(n) }));
    }
    setBulk(null);
    setBulkVal("");
  };

  const allOn = validSel.length === variants.length && variants.length > 0;

  return (
    <div>
      {/* options */}
      <div className="divide-y divide-a-line rounded-xl ring-1 ring-a-line">
        {(["colour", "size"] as const).map((opt) => {
          const open = editing === opt;
          return (
            <div key={opt} className="px-3.5 py-3">
              <div className="flex items-start gap-3">
                <AIcon name={opt === "colour" ? "palette" : "layers"} size={16} className="mt-0.5 shrink-0 text-a-faint" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{opt === "colour" ? t("products.variants.colour") : t("products.variants.size")}</p>
                  {!open ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {opt === "colour"
                        ? p.colors.map((c) => (
                            <span key={c.name} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-a-ink/[0.05] ps-1 pe-2.5 text-[12px] text-a-dim">
                              <span className="size-4 rounded-full ring-1 ring-a-ink/15" style={{ background: c.hex }} />
                              {c.name || t("products.variants.unnamed")}
                            </span>
                          ))
                        : p.sizes.map((s) => (
                            <span key={s.label} className="inline-flex h-6 items-center rounded-full bg-a-ink/[0.05] px-2.5 text-[12px] font-medium text-a-dim">
                              {s.label}
                            </span>
                          ))}
                    </div>
                  ) : null}
                </div>
                <Button type="button" size="xs" variant={open ? "secondary" : "ghost"} onClick={() => setEditing(open ? null : opt)}>
                  {open ? t("common.done") : t("common.edit")}
                </Button>
              </div>
              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                    <div className="pt-3">{opt === "colour" ? <ColourOption p={p} onChange={onChange} /> : <SizeOption p={p} onChange={onChange} />}</div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-3 rounded-lg bg-a-danger/10 px-3 py-2 text-[12.5px] text-a-danger">{error}</p> : null}

      {/* bulk toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-a-dim">
          <input type="checkbox" checked={allOn} onChange={(e) => toggle(variants.map((v) => v.id), e.target.checked)} className="size-4 accent-[var(--color-a-violet)]" aria-label={t("products.variants.selectAll")} />
          {validSel.length ? t("products.variants.selected", { count: validSel.length }) : t("products.variants.count", { count: variants.length })}
        </label>
        <span className="ms-auto flex flex-wrap items-center gap-1.5">
          <Button type="button" size="xs" variant={bulk === "stock" ? "secondary" : "ghost"} icon="inventory" disabled={!tracked} onClick={() => (setBulk(bulk === "stock" ? null : "stock"), setBulkVal(""))}>
            {validSel.length ? t("products.variants.setStockSel") : t("products.variants.setStockAll")}
          </Button>
          <Button type="button" size="xs" variant={bulk === "price" ? "secondary" : "ghost"} icon="tag" onClick={() => (setBulk(bulk === "price" ? null : "price"), setBulkVal(""))}>
            {t("products.variants.editPrices")}
          </Button>
        </span>
      </div>
      <AnimatePresence initial={false}>
        {bulk ? (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              applyBulk();
            }}
          >
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-a-violet/[0.06] p-2.5 ring-1 ring-a-violet/20">
              <span className="text-[12.5px] text-a-dim">
                {bulk === "stock" ? t("products.variants.stockFor", { count: scope.length }) : t("products.variants.priceFor", { count: scope.length })}
              </span>
              <Input
                autoFocus
                aria-label={bulk === "stock" ? t("products.variants.stockSelAria") : t("products.variants.priceSelAria")}
                type="number"
                min={0}
                inputMode="numeric"
                prefix={bulk === "price" ? "EGP" : undefined}
                value={bulkVal}
                placeholder={bulk === "price" ? t("products.variants.productPricePh", { price: p.price || 0 }) : "0"}
                onChange={(e) => setBulkVal(e.target.value)}
                className="w-[170px]"
              />
              <Button type="submit" size="sm" variant="primary">
                {t("common.apply")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setBulk(null)}>
                {t("common.cancel")}
              </Button>
              {bulk === "price" ? <span className="text-[11.5px] text-a-faint">{t("products.variants.leaveEmpty")}</span> : null}
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {/* table */}
      <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-a-line">
        <div className="hidden grid-cols-[28px_minmax(0,1fr)_118px_120px_120px] items-center gap-3 border-b border-a-line bg-a-ink/[0.02] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-a-faint md:grid">
          <span />
          <span>{t("products.variants.thVariant")}</span>
          <span>{t("products.variants.thPrice")}</span>
          <span>{t("products.variants.thAvailable")}</span>
          <span>{t("products.variants.thSku")}</span>
        </div>
        {groups.map(({ color, rows }) => {
          const isOpen = !collapsed.has(color.name);
          const stock = rows.reduce((n, v) => n + v.stock, 0);
          const prices = rows.map((v) => v.price ?? p.price);
          const lo = Math.min(...prices, p.price || 0);
          const hi = Math.max(...prices, 0);
          const ids = rows.map((v) => v.id);
          const groupOn = ids.length > 0 && ids.every((id) => sel.has(id));
          return (
            <div key={color.name} className="border-b border-a-line last:border-0">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 bg-a-panel-2/40 px-3 py-2.5 md:grid-cols-[28px_minmax(0,1fr)_118px_120px_120px]">
                <input type="checkbox" checked={groupOn} onChange={(e) => toggle(ids, e.target.checked)} aria-label={t("products.variants.selectGroup", { name: color.name })} className="size-4 accent-[var(--color-a-violet)]" />
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setCollapsed((s) => {
                      const n = new Set(s);
                      if (n.has(color.name)) n.delete(color.name);
                      else n.add(color.name);
                      return n;
                    })
                  }
                  className="flex min-w-0 items-center gap-2.5 text-start"
                >
                  <Thumb src={color.images[0]} className="size-9 ring-1 ring-a-line" sizes="40px" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium">
                      <span className="size-3 shrink-0 rounded-full ring-1 ring-a-ink/15" style={{ background: color.hex }} />
                      <span className="truncate">{color.name || t("products.variants.unnamed")}</span>
                    </span>
                    <span className="text-[11.5px] text-a-faint">
                      {t("products.variants.count", { count: rows.length })}
                    </span>
                  </span>
                  <AIcon name="chevronDown" size={14} className={cx("ms-1 shrink-0 text-a-faint transition-transform duration-200", !isOpen && "-rotate-90 rtl:rotate-90")} />
                </button>
                <span className="hidden text-[12.5px] tabular-nums text-a-dim md:block">
                  <bdi dir="ltr">{lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`}</bdi>
                </span>
                <span className={cx("text-end text-[12.5px] tabular-nums md:text-start", !tracked ? "text-a-faint" : stock === 0 ? "text-a-danger" : "text-a-dim")}>{tracked ? t("products.variants.available", { count: stock }) : t("products.variants.notTracked")}</span>
                <span className="hidden md:block" />
              </div>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                    {rows.map((v) => {
                      const on = sel.has(v.id);
                      return (
                        <div key={v.id} className={cx("grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-t border-a-line/60 px-3 py-2 transition-colors md:grid-cols-[28px_minmax(0,1fr)_118px_120px_120px]", on && "bg-a-violet/[0.05]")}>
                          <input type="checkbox" checked={on} onChange={(e) => toggle([v.id], e.target.checked)} aria-label={t("products.variants.selectOne", { name: color.name, size: v.size })} className="size-4 accent-[var(--color-a-violet)]" />
                          <span className="flex min-w-0 items-center gap-2.5 ps-3 md:ps-6">
                            <Thumb src={color.images[0]} className="size-7 ring-1 ring-a-line" sizes="32px" rounded="rounded-md" />
                            <span className="truncate text-[13px]">
                              <span className="text-a-faint">{color.name} /</span> <span className="font-medium">{v.size}</span>
                            </span>
                            {tracked && v.stock === 0 ? <Badge tone="red">{t("products.variants.soldOut")}</Badge> : tracked && v.stock <= LOW_STOCK ? <Badge tone="amber">{t("products.variants.low")}</Badge> : null}
                          </span>
                          <div className="col-start-2 grid grid-cols-3 gap-2 md:contents">
                            <Input
                              aria-label={t("products.variants.priceAria", { name: color.name, size: v.size })}
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={v.price ?? ""}
                              placeholder={String(p.price || 0)}
                              onChange={(e) => patch([v.id], (x) => ({ ...x, price: e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)) }))}
                              className="h-8 text-[12.5px]"
                            />
                            {tracked ? (
                              <Stepper compact label={t("products.variants.stockAria", { name: color.name, size: v.size })} value={v.stock} onChange={(n) => patch([v.id], (x) => ({ ...x, stock: n }))} />
                            ) : (
                              <span className="text-[12px] text-a-faint">{t("products.variants.notTracked")}</span>
                            )}
                            <Input dir="ltr" aria-label={t("products.variants.skuAria", { name: color.name, size: v.size })} value={v.sku ?? ""} placeholder={p.sku ? `${p.sku}-${v.size}` : "SKU"} onChange={(e) => patch([v.id], (x) => ({ ...x, sku: e.target.value.slice(0, 100) || undefined }))} className="h-8 text-[12.5px]" />
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 flex items-center justify-between text-[12px] text-a-faint">
        <span>{t("products.variants.footerHint")}</span>
        <span>
          {t("products.variants.total")} <span className="font-medium tabular-nums text-a-text">{tracked ? total.toLocaleString("en") : "—"}</span> {tracked ? t("products.variants.units") : ""}
        </span>
      </p>
    </div>
  );
}
