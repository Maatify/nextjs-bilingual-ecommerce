"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { cx } from "@/lib/format";
import type { Gender, Product } from "@/lib/types";
import type { AssignableCollection } from "@/server/queries/catalog";
import { AIcon } from "../../icons";
import { useT } from "../../i18n";
import { Field, Input, Select, ease } from "../../ui";
import { Chip, slugify } from "../shared";

const BADGES = ["Bestseller", "New", "Limited", "Online exclusive"] as const;

/**
 * Shopify "Product organization": Product type (our `category`), Categories (tag / manual
 * collections as checkboxes) and free-form Tags (stored in `collections`).
 */
export function OrganizationCard({
  p,
  set,
  manual,
  onManual,
  categories,
  collections,
  allTags,
  categoryError,
}: {
  p: Product;
  set: <K extends keyof Product>(key: K, value: Product[K]) => void;
  manual: string[];
  onManual: (handles: string[]) => void;
  categories: string[];
  collections: AssignableCollection[];
  allTags: string[];
  categoryError?: string;
}) {
  const { t } = useT();
  const [customCat, setCustomCat] = useState(!!p.category && !categories.includes(p.category));
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const listId = useId();

  const isIn = (c: AssignableCollection) => (c.type === "tag" ? p.collections.includes(c.tag!) : manual.includes(c.handle));
  const toggle = (c: AssignableCollection) => {
    if (c.type === "tag") set("collections", isIn(c) ? p.collections.filter((t) => t !== c.tag) : [...p.collections, c.tag!]);
    else onManual(isIn(c) ? manual.filter((h) => h !== c.handle) : [...manual, c.handle]);
  };
  const addTag = (raw = tag) => {
    const parts = raw.split(",").map(slugify).filter(Boolean);
    const next = [...p.collections];
    for (const t of parts) if (!next.includes(t)) next.push(t);
    if (next.length !== p.collections.length) set("collections", next);
    setTag("");
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? collections.filter((c) => c.path.toLowerCase().includes(t)) : collections;
  }, [collections, q]);
  const selectedCount = collections.filter(isIn).length;
  const suggestions = allTags.filter((t) => !p.collections.includes(t));

  return (
    <div className="grid gap-4">
      <Field label={t("products.org.type")} htmlFor="category" error={categoryError}>
        <Select
          id="category"
          value={customCat ? "__custom" : p.category}
          onChange={(e) => {
            if (e.target.value === "__custom") {
              setCustomCat(true);
              set("category", "");
            } else {
              setCustomCat(false);
              set("category", e.target.value);
            }
          }}
        >
          {!p.category && !customCat ? <option value="">{t("products.org.choose")}</option> : null}
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__custom">{t("products.org.newType")}</option>
        </Select>
        <AnimatePresence initial={false}>
          {customCat ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden">
              <Input aria-label={t("products.org.newTypeAria")} autoFocus value={p.category} placeholder={t("products.org.newTypePh")} onChange={(e) => set("category", e.target.value)} className="mt-2" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Field>

      <Field label={<span>{t("products.org.categories")} {selectedCount ? <span className="text-a-faint">· {selectedCount}</span> : null}</span>}>
        <div className="rounded-xl ring-1 ring-a-line">
          {collections.length > 6 ? (
            <div className="relative border-b border-a-line">
              <AIcon name="search" size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-a-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("products.org.searchCategories")} aria-label={t("products.org.searchCategories")} className="h-9 w-full bg-transparent ps-8 pe-3 text-[12.5px] outline-none placeholder:text-a-faint" />
            </div>
          ) : null}
          <ul className="a-scroll max-h-[220px] overflow-y-auto p-1">
            {shown.map((c) => {
              const on = isIn(c);
              return (
                <li key={c.handle}>
                  <label className={cx("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition hover:bg-a-hover", on && "text-a-text")}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c)} className="size-4 shrink-0 accent-[var(--color-a-violet)]" />
                    <span className={cx("min-w-0 flex-1 truncate", !on && "text-a-dim")}>{c.path}</span>
                    <span className="shrink-0 text-[10.5px] uppercase tracking-[0.06em] text-a-faint" title={c.type === "tag" ? t("products.org.autoTitle", { tag: c.tag ?? "" }) : t("products.org.manualTitle")}>
                      {c.type === "tag" ? t("products.org.auto") : t("products.org.manual")}
                    </span>
                  </label>
                </li>
              );
            })}
            {!shown.length ? <li className="px-2 py-3 text-center text-[12px] text-a-faint">{collections.length ? t("products.org.noMatch") : t("products.org.noCategories")}</li> : null}
          </ul>
        </div>
      </Field>

      <Field label={t("products.org.tags")} hint={t("products.org.tagsHint")}>
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-[10px] border border-a-line bg-a-panel-2 p-1.5 transition has-[input:focus]:border-a-violet/70 has-[input:focus]:ring-[3px] has-[input:focus]:ring-a-violet/20">
          <AnimatePresence initial={false}>
            {p.collections.map((t) => (
              <motion.span key={t} layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.16, ease }}>
                <Chip onRemove={() => set("collections", p.collections.filter((x) => x !== t))}>{t}</Chip>
              </motion.span>
            ))}
          </AnimatePresence>
          <input
            aria-label={t("products.org.addTag")}
            list={listId}
            value={tag}
            onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value) : setTag(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              } else if (e.key === "Backspace" && !tag && p.collections.length) set("collections", p.collections.slice(0, -1));
            }}
            onBlur={() => tag.trim() && addTag()}
            placeholder={p.collections.length ? "" : t("products.org.tagsPh")}
            className="h-6 min-w-[90px] flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-a-faint"
          />
          <datalist id={listId}>
            {suggestions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("products.org.badge")} htmlFor="badge">
          <Select id="badge" value={p.badge ?? ""} onChange={(e) => set("badge", (e.target.value || undefined) as Product["badge"])}>
            <option value="">{t("common.none")}</option>
            {BADGES.map((b) => (
              <option key={b} value={b}>
                {t(`products.org.badges.${b}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("products.org.gender")} htmlFor="gender">
          <Select id="gender" value={p.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
            <option value="unisex">{t("products.org.genders.unisex")}</option>
            <option value="women">{t("products.org.genders.women")}</option>
            <option value="men">{t("products.org.genders.men")}</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}
