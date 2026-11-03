"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMemo, useState } from "react";
import { deleteCategories, quickEditCategory, reorderCategories, saveCategory } from "@/app/admin/(panel)/categories/actions";
import { cx } from "@/lib/format";
import { collectionCompleteness, isMissing } from "@/lib/i18n/admin/completeness";
import type { AdminLocale } from "@/lib/i18n/admin";
import type { Collection, CollectionAr, CollectionRule } from "@/lib/types";
import type { PickProduct } from "@/server/queries/catalog";
import { ArChip, ContentLangTabs, TranslationMeter, arProps, useT } from "../i18n";
import { AIcon } from "../icons";
import { MediaPicker } from "../media-picker";
import { Badge, Button, Card, Checkbox, ConfirmButton, Drawer, EmptyState, Field, IconBtn, Input, PageHeader, Select, Switch, Tabs, Textarea, ease, toast } from "../ui";
import { matchesRule } from "./rules";
import { HANDLE_RE, Thumb, slugify } from "./shared";

/*
 * WooCommerce "Products › Categories": add form on the left, hierarchical table on the right
 * with hover row actions (Edit · Quick edit · Delete · View), bulk delete and search.
 * Categories are the store's collections (+ optional parent).
 */

const BLANK: Collection = { handle: "", title: "", description: "", image: "", rule: { type: "manual", productIds: [] } };
type Row = { c: Collection; depth: number };

/** Parents first (in store order), each followed by its children — like the WordPress term list. */
function flatten(cats: Collection[]): Row[] {
  const known = new Set(cats.map((c) => c.handle));
  const kids = new Map<string, Collection[]>();
  for (const c of cats) if (c.parent && known.has(c.parent) && c.parent !== c.handle) kids.set(c.parent, [...(kids.get(c.parent) ?? []), c]);
  const out: Row[] = [];
  const seen = new Set<string>();
  const walk = (c: Collection, depth: number) => {
    if (seen.has(c.handle)) return;
    seen.add(c.handle);
    out.push({ c, depth });
    for (const k of kids.get(c.handle) ?? []) walk(k, depth + 1);
  };
  for (const c of cats) if (!c.parent || !known.has(c.parent)) walk(c, 0);
  for (const c of cats) walk(c, 0); // anything left (cycles) at the root
  return out;
}

const descendants = (cats: Collection[], handle: string) => {
  const out = new Set<string>([handle]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cats) if (c.parent && out.has(c.parent) && !out.has(c.handle)) (out.add(c.handle), (grew = true));
  }
  return out;
};

export function CategoriesManager({ categories, products, tags }: { categories: Collection[]; products: PickProduct[]; tags: string[] }) {
  const { t: tr, isRtl } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [missingAr, setMissingAr] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState("");
  const [quick, setQuick] = useState<string | null>(null);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [session, setSession] = useState(0);
  const [formKey, setFormKey] = useState(0);

  const rows = useMemo(() => flatten(categories), [categories]);
  const byHandle = useMemo(() => new Map(categories.map((c) => [c.handle, c])), [categories]);
  const t = q.trim().toLowerCase();
  const missingCount = useMemo(() => categories.filter((c) => isMissing(collectionCompleteness(c))).length, [categories]);
  const visible = rows.filter(
    (r) => (!t || r.c.title.toLowerCase().includes(t) || r.c.handle.includes(t) || r.c.description.toLowerCase().includes(t) || (r.c.ar?.title ?? "").includes(q.trim())) && (!missingAr || isMissing(collectionCompleteness(r.c))),
  );
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.c.handle));
  const count = (c: Collection) => products.filter((p) => p.status === "active" && matchesRule(c.rule, p)).length;

  const toggle = (h: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(h)) n.delete(h);
      else n.add(h);
      return n;
    });

  const remove = async (handles: string[]) => {
    const res = await deleteCategories(handles);
    if (!res.ok) return toast.error(tr("catalog.categories.toast.deleteFailed"), res.error);
    toast.success(tr("catalog.categories.toast.deleted", { count: res.data ?? 0 }), tr("catalog.categories.toast.deletedBody"));
    setSelected(new Set());
    setEditing(null);
    router.refresh();
  };

  const applyBulk = () => {
    if (bulk === "delete" && selected.size) remove([...selected]);
    setBulk("");
  };

  /** Move a category up/down among its siblings (the order used in navigation and chips). */
  const move = async (c: Collection, dir: -1 | 1) => {
    const order = categories.map((x) => x.handle);
    const siblings = categories.filter((x) => (x.parent ?? "") === (c.parent ?? "")).map((x) => x.handle);
    const i = siblings.indexOf(c.handle);
    const other = siblings[i + dir];
    if (!other) return;
    const a = order.indexOf(c.handle);
    const b = order.indexOf(other);
    [order[a], order[b]] = [order[b], order[a]];
    const res = await reorderCategories(order);
    if (!res.ok) return toast.error(tr("catalog.categories.toast.reorderFailed"), res.error);
    router.refresh();
  };

  const openEdit = (c: Collection) => {
    setSession((n) => n + 1);
    setEditing(structuredClone(c));
  };

  return (
    <>
      <PageHeader
        title={tr("catalog.categories.title")}
        description={tr("catalog.categories.description")}
        actions={
          <Button variant="primary" icon="plus" onClick={() => document.getElementById("cat-name")?.focus()}>
            {tr("catalog.categories.add")}
          </Button>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card title={tr("catalog.categories.addNew")} className="lg:sticky lg:top-4">
          <AddCategory key={formKey} categories={categories} products={products} tags={tags} onCreated={() => (setFormKey((k) => k + 1), router.refresh())} />
        </Card>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select aria-label={tr("catalog.categories.bulkActions")} value={bulk} onChange={(e) => setBulk(e.target.value)} className="w-[150px]">
              <option value="">{tr("catalog.categories.bulkActions")}</option>
              <option value="delete">{tr("common.delete")}</option>
            </Select>
            <Button onClick={applyBulk} disabled={!bulk || !selected.size}>
              {tr("common.apply")}
            </Button>
            {selected.size ? <span className="text-[12.5px] text-a-dim">{tr("common.selected", { count: selected.size })}</span> : null}
            <button
              type="button"
              aria-pressed={missingAr}
              onClick={() => setMissingAr((v) => !v)}
              className={cx("fx-press ms-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-medium ring-1 ring-inset transition", missingAr ? "bg-a-warn/12 text-a-warn ring-a-warn/30" : "bg-a-panel-2 text-a-dim ring-a-line hover:text-a-text hover:ring-a-line-strong")}
            >
              <AIcon name="globe" size={14} />
              {tr("common.translation.missingArabic")}
              <span className="rounded-full bg-a-ink/[0.07] px-1.5 text-[11px] tabular-nums">{missingCount}</span>
            </button>
            <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
              <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
              <Input aria-label={tr("catalog.categories.search")} placeholder={tr("catalog.categories.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-a-line bg-a-panel">
            <div className="grid grid-cols-[28px_44px_minmax(0,1fr)_56px] items-center gap-3 border-b border-a-line px-3 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint md:grid-cols-[28px_44px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_64px] md:px-4">
              <Checkbox checked={allChecked} onChange={(v) => setSelected(v ? new Set(visible.map((r) => r.c.handle)) : new Set())} label={<span className="sr-only">{tr("catalog.list.selectAll")}</span>} />
              <span><span className="sr-only">{tr("catalog.categories.cols.image")}</span></span>
              <span>{tr("catalog.categories.cols.name")}</span>
              <span className="hidden md:block">{tr("catalog.categories.cols.description")}</span>
              <span className="hidden md:block">{tr("catalog.categories.cols.slug")}</span>
              <span className="text-end">{tr("catalog.categories.cols.count")}</span>
            </div>
            {!visible.length ? (
              <EmptyState icon="collections" title={categories.length ? tr("catalog.categories.noMatch") : tr("catalog.categories.empty")} description={categories.length ? tr("catalog.categories.noMatchBody") : tr("catalog.categories.emptyBody")} />
            ) : (
              <LayoutGroup>
                <ul>
                  <AnimatePresence initial={false}>
                    {visible.map(({ c, depth }, i) =>
                      quick === c.handle ? (
                        <QuickEdit key={c.handle} c={c} handles={categories.map((x) => x.handle)} onDone={(saved) => (setQuick(null), saved && router.refresh())} />
                      ) : (
                        <motion.li
                          key={c.handle}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: isRtl ? 12 : -12 }}
                          transition={{ duration: 0.24, ease, delay: Math.min(i, 12) * 0.015 }}
                          className={cx(
                            "group grid grid-cols-[28px_44px_minmax(0,1fr)_56px] items-start gap-3 border-b border-a-line/70 px-3 py-3 text-[13px] transition-colors last:border-0 hover:bg-a-violet/[0.045] md:grid-cols-[28px_44px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_64px] md:px-4",
                            selected.has(c.handle) && "bg-a-violet/[0.05]",
                          )}
                        >
                          <span className="pt-2.5">
                            <Checkbox checked={selected.has(c.handle)} onChange={() => toggle(c.handle)} label={<span className="sr-only">{tr("catalog.list.selectOne", { title: c.title })}</span>} />
                          </span>
                          <Thumb src={c.image || products.find((p) => matchesRule(c.rule, p))?.image} className="size-11" rounded="rounded-lg" sizes="44px" />
                          <div className="min-w-0">
                            <button type="button" onClick={() => openEdit(c)} className="flex max-w-full items-center gap-1.5 text-start font-medium text-a-text hover:text-a-accent" style={{ paddingInlineStart: depth * 16 }}>
                              {depth ? <span className="text-a-faint">{"— ".repeat(depth)}</span> : null}
                              <span className="truncate">{c.title}</span>
                              {c.hidden ? <Badge tone="neutral" className="ms-1">{tr("common.hidden")}</Badge> : null}
                              {c.rule.type !== "manual" ? <Badge tone="violet" className="ms-1">{tr("catalog.categories.auto")}</Badge> : null}
                            </button>
                            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-a-faint" style={{ paddingInlineStart: depth * 16 }}>
                              {depth && c.parent ? <span>{tr("catalog.categories.inParent", { parent: byHandle.get(c.parent)?.title ?? "" })}</span> : null}
                              {c.ar?.title ? <span lang="ar" dir="rtl" className="truncate">{c.ar.title}</span> : null}
                              <CatMeter c={c} />
                            </span>
                            {/* WordPress-style row actions: visible on hover / focus, always on touch */}
                            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" style={{ paddingInlineStart: depth * 16 }}>
                              <button type="button" onClick={() => openEdit(c)} className="text-a-accent hover:underline">
                                {tr("common.edit")}
                              </button>
                              <span className="text-a-faint">|</span>
                              <button type="button" onClick={() => setQuick(c.handle)} className="text-a-accent hover:underline">
                                {tr("catalog.list.quickEdit")}
                              </button>
                              <span className="text-a-faint">|</span>
                              <InlineDelete onConfirm={() => remove([c.handle])} />
                              <span className="text-a-faint">|</span>
                              <a href={`/collections/${c.handle}`} target="_blank" rel="noopener noreferrer" className="text-a-accent hover:underline">
                                {tr("common.view")}
                              </a>
                              <span className="ms-1 flex items-center">
                                <IconBtn icon="chevronUp" label={tr("catalog.categories.moveUp", { title: c.title })} size={24} onClick={() => move(c, -1)} />
                                <IconBtn icon="chevronDown" label={tr("catalog.categories.moveDown", { title: c.title })} size={24} onClick={() => move(c, 1)} />
                              </span>
                            </div>
                          </div>
                          <p dir="auto" className="hidden pt-0.5 text-start text-[12.5px] leading-relaxed text-a-dim md:line-clamp-3">{(isRtl && c.ar?.description) || c.description || <span className="text-a-faint">—</span>}</p>
                          <span dir="ltr" className="hidden truncate pt-0.5 text-start font-mono text-[12px] text-a-dim md:block rtl:text-end">{c.handle}</span>
                          <span className="pt-0.5 text-end">
                            <a href={`/collections/${c.handle}`} target="_blank" rel="noopener noreferrer" className="tabular-nums text-a-accent hover:underline">
                              {count(c)}
                            </a>
                          </span>
                        </motion.li>
                      ),
                    )}
                  </AnimatePresence>
                </ul>
              </LayoutGroup>
            )}
          </div>
          <p className="mt-3 text-[12px] text-a-faint">{tr("catalog.categories.footer")}</p>
        </div>
      </div>

      <EditDrawer key={session} editing={editing} categories={categories} products={products} tags={tags} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), router.refresh())} onDelete={(h) => remove([h])} />
    </>
  );
}

function CatMeter({ c }: { c: Collection }) {
  const m = collectionCompleteness(c);
  return <TranslationMeter done={m.done} total={m.total} compact className="h-[18px] px-1.5 text-[10.5px]" />;
}

function InlineDelete({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useT();
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : (setArmed(true), setTimeout(() => setArmed(false), 3000)))}
      className={cx("hover:underline", armed ? "font-medium text-a-danger" : "text-a-danger/85")}
    >
      {armed ? t("common.clickToConfirm") : t("common.delete")}
    </button>
  );
}

function QuickEdit({ c, handles, onDone }: { c: Collection; handles: string[]; onDone: (saved: boolean) => void }) {
  const { t } = useT();
  const [title, setTitle] = useState(c.title);
  const [handle, setHandle] = useState(c.handle);
  const [saving, setSaving] = useState(false);
  const err = !title.trim() ? t("catalog.categories.v.nameRequired") : !HANDLE_RE.test(handle) ? t("catalog.categories.v.slugChars") : handle !== c.handle && handles.includes(handle) ? t("catalog.categories.v.slugUsed") : null;
  const save = async () => {
    if (err) return toast.error(err);
    setSaving(true);
    const res = await quickEditCategory(c.handle, title, handle);
    setSaving(false);
    if (!res.ok) return toast.error(t("catalog.categories.toast.updateFailed"), res.error);
    toast.success(t("catalog.categories.toast.updated"));
    onDone(true);
  };
  return (
    <motion.li layout initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }} className="border-b border-a-line/70 bg-a-violet/[0.05] px-4 py-4 last:border-0">
      <p className="mb-3 text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint">{t("catalog.list.quickEdit")}</p>
      <div
        className="grid gap-3 sm:grid-cols-2"
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.preventDefault(), save());
          if (e.key === "Escape") onDone(false);
        }}
      >
        <Field label={t("catalog.categories.f.name")} htmlFor={`qe-n-${c.handle}`}>
          <Input id={`qe-n-${c.handle}`} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t("catalog.categories.f.slug")} htmlFor={`qe-s-${c.handle}`} error={err && title.trim() ? err : undefined}>
          <Input id={`qe-s-${c.handle}`} dir="ltr" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="primary" loading={saving} onClick={save}>
          {t("catalog.categories.updateCategory")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    </motion.li>
  );
}

/* ───────────── shared form ───────────── */

type FormProps = { c: Collection; set: (patch: Partial<Collection>) => void; categories: Collection[]; products: PickProduct[]; tags: string[]; selfHandle?: string; errors: Record<string, string | undefined>; showErrors: boolean; idPrefix: string };

function validate(c: Collection, categories: Collection[], t: ReturnType<typeof useT>["t"], selfHandle?: string) {
  return {
    title: !c.title.trim() ? t("catalog.categories.v.nameRequired") : undefined,
    handle: !c.handle ? t("catalog.categories.v.slugRequired") : !HANDLE_RE.test(c.handle) ? t("catalog.categories.v.slugChars") : c.handle !== selfHandle && categories.some((x) => x.handle === c.handle) ? t("catalog.categories.v.slugTaken") : undefined,
    tag: c.rule.type === "tag" && !c.rule.tag.trim() ? t("catalog.categories.v.chooseTag") : undefined,
  };
}

function CategoryFields({ c, set, categories, products, tags, selfHandle, errors, showErrors, idPrefix }: FormProps) {
  const { t: tr } = useT();
  const [picker, setPicker] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!selfHandle);
  const banned = selfHandle ? descendants(categories, selfHandle) : new Set<string>();
  const parents = flatten(categories).filter((r) => !banned.has(r.c.handle));
  const auto = c.rule.type !== "manual";
  const setType = (manual: boolean) => {
    if (manual === !auto) return;
    set({ rule: manual ? { type: "manual", productIds: products.filter((p) => matchesRule(c.rule, p)).map((p) => p.id) } : { type: "sale" } });
  };

  return (
    <div className="grid gap-4">
      <Field label={tr("catalog.categories.f.name")} htmlFor={`${idPrefix}-name`} error={showErrors ? errors.title : undefined} hint={tr("catalog.categories.f.nameHint")}>
        <Input id={`${idPrefix}-name`} value={c.title} onChange={(e) => set({ title: e.target.value, ...(slugTouched ? {} : { handle: slugify(e.target.value) }) })} />
      </Field>
      <Field label={tr("catalog.categories.f.slug")} htmlFor={`${idPrefix}-slug`} error={errors.handle && (showErrors || slugTouched) ? errors.handle : undefined} hint={<bdi dir="ltr">URL: /collections/{c.handle || "…"}</bdi>}>
        <Input
          id={`${idPrefix}-slug`}
          dir="ltr"
          value={c.handle}
          onChange={(e) => {
            setSlugTouched(true);
            set({ handle: e.target.value.toLowerCase().replace(/\s+/g, "-") });
          }}
        />
      </Field>
      <Field label={tr("catalog.categories.f.parent")} htmlFor={`${idPrefix}-parent`} hint={tr("catalog.categories.f.parentHint")}>
        <Select id={`${idPrefix}-parent`} value={c.parent ?? ""} onChange={(e) => set({ parent: e.target.value || undefined })}>
          <option value="">{tr("common.none")}</option>
          {parents.map((r) => (
            <option key={r.c.handle} value={r.c.handle}>
              {" ".repeat(r.depth * 3)}
              {r.c.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={tr("catalog.categories.f.description")} htmlFor={`${idPrefix}-desc`}>
        <Textarea id={`${idPrefix}-desc`} rows={3} value={c.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label={tr("catalog.categories.f.thumbnail")}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPicker(true)} className="block overflow-hidden rounded-xl ring-1 ring-a-line transition hover:ring-a-accent" aria-label={tr("catalog.categories.f.chooseImage")}>
            <Thumb src={c.image} className="h-20 w-16" rounded="rounded-xl" sizes="64px" />
          </button>
          <div className="flex flex-col gap-1.5">
            <Button size="sm" icon="media" onClick={() => setPicker(true)}>
              {c.image ? tr("catalog.categories.f.changeImage") : tr("catalog.categories.f.addImage")}
            </Button>
            {c.image ? (
              <Button size="sm" variant="ghost" onClick={() => set({ image: "" })}>
                {tr("common.remove")}
              </Button>
            ) : null}
          </div>
        </div>
      </Field>

      <Field label={tr("catalog.categories.f.products")}>
        <Tabs<"manual" | "auto">
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          size="sm"
          value={auto ? "auto" : "manual"}
          onChange={(v) => setType(v === "manual")}
          items={[
            { value: "manual", label: tr("catalog.categories.f.manual") },
            { value: "auto", label: tr("catalog.categories.f.automatic") },
          ]}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={auto ? "auto" : "manual"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16, ease }} className="mt-3">
            {auto ? (
              <div className="grid gap-2">
                <Select aria-label={tr("catalog.categories.f.rule")} value={c.rule.type} onChange={(e) => set({ rule: e.target.value === "tag" ? { type: "tag", tag: tags[0] ?? "" } : ({ type: e.target.value } as CollectionRule) })}>
                  <option value="sale">{tr("catalog.rules.sale")}</option>
                  <option value="all">{tr("catalog.rules.all")}</option>
                  <option value="tag">{tr("catalog.categories.f.withTag")}</option>
                </Select>
                {c.rule.type === "tag" ? (
                  <Field error={showErrors ? errors.tag : undefined}>
                    <Select aria-label={tr("catalog.list.tagLabel")} value={c.rule.tag} onChange={(e) => set({ rule: { type: "tag", tag: e.target.value } })}>
                      <option value="">{tr("catalog.categories.f.chooseTag")}</option>
                      {[...new Set([...tags, c.rule.tag].filter(Boolean))].map((t) => (
                        <option key={t} value={t}>
                          {t} ({products.filter((p) => p.collections.includes(t)).length})
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <p className="text-[12px] text-a-faint">{tr("catalog.categories.f.matches", { count: products.filter((p) => p.status === "active" && matchesRule(c.rule, p)).length })}</p>
              </div>
            ) : (
              <ManualProducts ids={c.rule.type === "manual" ? c.rule.productIds : []} products={products} onChange={(productIds) => set({ rule: { type: "manual", productIds } })} />
            )}
          </motion.div>
        </AnimatePresence>
      </Field>
      <MediaPicker open={picker} onClose={() => setPicker(false)} title={tr("catalog.categories.f.image")} onSelect={(urls) => urls[0] && set({ image: urls[0] })} />
    </div>
  );
}

function ManualProducts({ ids, products, onChange }: { ids: string[]; products: PickProduct[]; onChange: (ids: string[]) => void }) {
  const { t: tr } = useT();
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const list = products.filter((p) => p.status !== "archived" && (!t || p.title.toLowerCase().includes(t)));
  const set = new Set(ids);
  return (
    <div className="rounded-xl border border-a-line">
      <div className="relative border-b border-a-line p-2">
        <AIcon name="search" size={14} className="pointer-events-none absolute start-4.5 top-1/2 -translate-y-1/2 text-a-faint" />
        <Input aria-label={tr("catalog.list.searchLabel")} placeholder={tr("catalog.categories.f.manualSearch", { count: ids.length })} value={q} onChange={(e) => setQ(e.target.value)} className="h-8 ps-8 text-[12.5px]" />
      </div>
      <div className="a-scroll max-h-52 overflow-y-auto p-1">
        {list.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] transition hover:bg-a-hover">
            <Checkbox checked={set.has(p.id)} onChange={(v) => onChange(v ? [...ids, p.id] : ids.filter((x) => x !== p.id))} />
            <Thumb src={p.image} className="h-8 w-6" sizes="24px" rounded="rounded" />
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            {p.status !== "active" ? <span className="text-[11px] text-a-faint">{tr(`catalog.status.${p.status as "draft" | "archived"}`)}</span> : null}
          </label>
        ))}
        {!list.length ? <p className="px-2 py-3 text-center text-[12px] text-a-faint">{tr("catalog.list.noMatchTitle")}</p> : null}
      </div>
    </div>
  );
}

function AddCategory({ categories, products, tags, onCreated }: { categories: Collection[]; products: PickProduct[]; tags: string[]; onCreated: () => void }) {
  const { t } = useT();
  const [c, setC] = useState<Collection>(() => structuredClone(BLANK));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validate(c, categories, t);
  const save = async () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return toast.error(t("catalog.categories.v.checkFields"));
    setSaving(true);
    const res = await saveCategory(c);
    setSaving(false);
    if (!res.ok) return toast.error(t("catalog.categories.toast.addFailed"), res.error);
    toast.success(t("catalog.categories.toast.added"), c.parent ? t("catalog.categories.toast.under", { parent: categories.find((x) => x.handle === c.parent)?.title ?? "" }) : t("catalog.categories.toast.live"));
    onCreated();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <CategoryFields c={c} set={(p) => setC((x) => ({ ...x, ...p }))} categories={categories} products={products} tags={tags} errors={errors} showErrors={tried} idPrefix="cat" />
      <Field className="mt-4" label={<span className="flex items-center gap-1.5">{t("catalog.categories.ar.title")} <ArChip /></span>} htmlFor="cat-ar-title" hint={t("common.translation.fallbackHint")}>
        <Input id="cat-ar-title" {...arProps} value={c.ar?.title ?? ""} placeholder={c.title} onChange={(e) => setC((x) => ({ ...x, ar: { ...x.ar, title: e.target.value } }))} />
      </Field>
      <Button type="submit" variant="primary" icon="plus" loading={saving} className="mt-5 w-full">
        {t("catalog.categories.addNew")}
      </Button>
    </form>
  );
}

function EditDrawer({ editing, categories, products, tags, onClose, onSaved, onDelete }: { editing: Collection | null; categories: Collection[]; products: PickProduct[]; tags: string[]; onClose: () => void; onSaved: () => void; onDelete: (h: string) => void }) {
  const { t, isRtl } = useT();
  const [original] = useState<Collection>(editing ?? BLANK);
  const [c, setC] = useState<Collection>(original);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<AdminLocale>("en");
  const errors = validate(c, categories, t, original.handle);
  const dirty = JSON.stringify(c) !== JSON.stringify(original);
  const meter = collectionCompleteness(c);
  const setAr = (patch: Partial<CollectionAr>) => setC((x) => ({ ...x, ar: { ...x.ar, ...patch } }));
  const save = async () => {
    if (Object.values(errors).some(Boolean)) {
      setLang("en");
      return toast.error(t("catalog.categories.v.checkFields"));
    }
    setSaving(true);
    const res = await saveCategory(c, original.handle);
    setSaving(false);
    if (!res.ok) return toast.error(t("catalog.categories.toast.saveFailed"), res.error);
    toast.success(t("catalog.categories.toast.saved"));
    onSaved();
  };
  return (
    <Drawer
      open={!!editing}
      onClose={onClose}
      width="max-w-[560px]"
      title={t("catalog.categories.editTitle", { title: original.title })}
      footer={
        <>
          <span className="me-auto">
            <ConfirmButton onConfirm={() => onDelete(original.handle)} confirmLabel={t("catalog.categories.clickToDelete")}>
              {t("common.delete")}
            </ConfirmButton>
          </span>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>
            {t("catalog.list.qe.update")}
          </Button>
        </>
      }
    >
      <div
        className="grid gap-5"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") (e.preventDefault(), save());
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ContentLangTabs value={lang} onChange={setLang} arDone={meter.done} arTotal={meter.total} />
          <TranslationMeter done={meter.done} total={meter.total} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {lang === "en" ? (
            <motion.div key="en" className="grid gap-5" initial={{ opacity: 0, x: isRtl ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRtl ? -10 : 10 }} transition={{ duration: 0.18, ease }}>
              <CategoryFields c={c} set={(p) => setC((x) => ({ ...x, ...p }))} categories={categories} products={products} tags={tags} selfHandle={original.handle} errors={errors} showErrors idPrefix="edit" />
              <div className="rounded-xl border border-a-line p-3.5">
                <Switch checked={!!c.hidden} onChange={(v) => setC((x) => ({ ...x, hidden: v || undefined }))} label={t("catalog.categories.f.hide")} description={t("catalog.categories.f.hideHint")} />
              </div>
              <div className="grid gap-3">
                <p className="text-[12.5px] font-medium text-a-dim">{t("catalog.categories.f.seo")}</p>
                <Field label={t("catalog.categories.f.seoTitle")} htmlFor="edit-seo-t">
                  <Input id="edit-seo-t" value={c.seoTitle ?? ""} placeholder={c.title} onChange={(e) => setC((x) => ({ ...x, seoTitle: e.target.value || undefined }))} />
                </Field>
                <Field label={t("catalog.categories.f.seoDescription")} htmlFor="edit-seo-d">
                  <Textarea id="edit-seo-d" rows={2} value={c.seoDescription ?? ""} placeholder={c.description} onChange={(e) => setC((x) => ({ ...x, seoDescription: e.target.value || undefined }))} />
                </Field>
              </div>
            </motion.div>
          ) : (
            <motion.div key="ar" className="grid gap-4" initial={{ opacity: 0, x: isRtl ? -10 : 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRtl ? 10 : -10 }} transition={{ duration: 0.18, ease }}>
              <p className="rounded-xl border border-a-line bg-a-panel-2/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-a-dim">{t("catalog.categories.ar.intro")}</p>
              <Field label={<span className="flex items-center gap-1.5">{t("catalog.categories.f.name")} <ArChip /></span>} htmlFor="edit-ar-title" hint={c.title ? t("common.translation.englishValue", { value: c.title }) : undefined}>
                <Input id="edit-ar-title" {...arProps} value={c.ar?.title ?? ""} placeholder={c.title} onChange={(e) => setAr({ title: e.target.value })} />
              </Field>
              <Field label={<span className="flex items-center gap-1.5">{t("catalog.categories.f.description")} <ArChip /></span>} htmlFor="edit-ar-desc" hint={t("common.translation.fallbackHint")}>
                <Textarea id="edit-ar-desc" {...arProps} rows={3} value={c.ar?.description ?? ""} placeholder={c.description} onChange={(e) => setAr({ description: e.target.value })} />
              </Field>
              <div className="grid gap-3">
                <p className="text-[12.5px] font-medium text-a-dim">{t("catalog.categories.f.seo")}</p>
                <Field label={<span className="flex items-center gap-1.5">{t("catalog.categories.f.seoTitle")} <ArChip /></span>} htmlFor="edit-ar-seo-t">
                  <Input id="edit-ar-seo-t" {...arProps} value={c.ar?.seoTitle ?? ""} placeholder={c.ar?.title || c.seoTitle || c.title} onChange={(e) => setAr({ seoTitle: e.target.value })} />
                </Field>
                <Field label={<span className="flex items-center gap-1.5">{t("catalog.categories.f.seoDescription")} <ArChip /></span>} htmlFor="edit-ar-seo-d">
                  <Textarea id="edit-ar-seo-d" {...arProps} rows={2} value={c.ar?.seoDescription ?? ""} placeholder={c.ar?.description || c.seoDescription || c.description} onChange={(e) => setAr({ seoDescription: e.target.value })} />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Drawer>
  );
}
