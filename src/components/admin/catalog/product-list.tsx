"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, Reorder, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteProducts, duplicateProduct, reorderProducts, setProductsStatus } from "@/app/admin/(panel)/products/actions";
import { bulkEditProducts, quickEditProduct, type BulkEditInput } from "@/app/admin/(panel)/products/list-actions";
import { cx, pctOff } from "@/lib/format";
import type { ProductStatus } from "@/lib/types";
import type { ProductRow } from "@/server/queries/catalog";
import { Tilt3D } from "@/components/fx/tilt";
import { isMissing, productCompleteness } from "@/lib/i18n/admin/completeness";
import { Ltr, TranslationMeter, useT } from "../i18n";
import { AIcon } from "../icons";
import { Badge, Button, Checkbox, ConfirmButton, Drawer, EmptyState, Field, Input, LinkButton, PageHeader, Select, Tabs, ease, egp, toast } from "../ui";
import { RowMenu, type MenuItem } from "./row-menu";
import { Chip, LOW_STOCK, SortableItem, Swatches, Thumb, lowSizes, move, statusTone } from "./shared";

type StatusTab = "all" | ProductStatus;
type SortKey = "manual" | "title" | "status" | "stock" | "price" | "sold" | "updated";
type Sort = { key: SortKey; dir: 1 | -1 };
type View = "table" | "grid";

const SORTS = [
  { value: "manual:1", label: "manual" },
  { value: "title:1", label: "titleAsc" },
  { value: "title:-1", label: "titleDesc" },
  { value: "price:-1", label: "priceDesc" },
  { value: "price:1", label: "priceAsc" },
  { value: "stock:1", label: "stockAsc" },
  { value: "stock:-1", label: "stockDesc" },
  { value: "sold:-1", label: "sold" },
  { value: "updated:-1", label: "updated" },
] as const;
const STATUS_RANK: Record<ProductStatus, number> = { active: 0, draft: 1, archived: 2 };
const CMP: Record<Exclude<SortKey, "manual">, (a: ProductRow, b: ProductRow) => number> = {
  title: (a, b) => a.product.title.localeCompare(b.product.title),
  status: (a, b) => STATUS_RANK[a.product.status ?? "active"] - STATUS_RANK[b.product.status ?? "active"],
  price: (a, b) => a.product.price - b.product.price,
  stock: (a, b) => a.stock - b.stock,
  sold: (a, b) => a.sold - b.sold,
  updated: (a, b) => (a.product.updatedAt ?? "").localeCompare(b.product.updatedAt ?? ""),
};

const COLS = "grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[28px_28px_minmax(200px,2.4fr)_96px_110px_120px_minmax(120px,1fr)_72px_36px]";

export function ProductList({ rows, initialTag = "all" }: { rows: ProductRow[]; initialTag?: string }) {
  const { t: tr } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<View>("table");
  const [tab, setTab] = useState<StatusTab>("all");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<Sort>({ key: "manual", dir: 1 });
  const [tag, setTag] = useState(initialTag);
  const [missingAr, setMissingAr] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  /** Click a column header: first click sorts (A→Z / low→high, but newest/most first for sold), second flips, third resets. */
  const sortBy = (key: Exclude<SortKey, "manual">) =>
    setSort((s) => {
      const first: 1 | -1 = key === "sold" || key === "updated" ? -1 : 1;
      if (s.key !== key) return { key, dir: first };
      if (s.dir === first) return { key, dir: (first * -1) as 1 | -1 };
      return { key: "manual", dir: 1 };
    });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // local order (drag-to-reorder) — adopt server order whenever it changes
  const serverOrder = useMemo(() => rows.map((r) => r.product.id), [rows]);
  const [order, setOrder] = useState(serverOrder);
  const [base, setBase] = useState(serverOrder);
  if (base !== serverOrder) {
    setBase(serverOrder);
    setOrder(serverOrder);
  }
  const orderRef = useRef(order);
  const committed = useRef(serverOrder.join());
  useEffect(() => {
    orderRef.current = order;
  }, [order]);
  useEffect(() => {
    committed.current = serverOrder.join();
  }, [serverOrder]);
  const applyOrder = (ids: string[]) => {
    orderRef.current = ids;
    setOrder(ids);
  };

  const byId = useMemo(() => new Map(rows.map((r) => [r.product.id, r])), [rows]);
  const arMissing = useMemo(() => new Set(rows.filter((r) => isMissing(productCompleteness(r.product))).map((r) => r.product.id)), [rows]);
  const categories = useMemo(() => [...new Set(rows.map((r) => r.product.category))].sort(), [rows]);
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.product.collections))].sort(), [rows]);
  const counts = useMemo(() => {
    const c = { all: rows.length, active: 0, draft: 0, archived: 0 };
    rows.forEach((r) => c[r.product.status ?? "active"]++);
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = order.map((id) => byId.get(id)).filter((r): r is ProductRow => !!r);
    list = list.filter(
      (r) =>
        (tab === "all" || (r.product.status ?? "active") === tab) &&
        (cat === "all" || r.product.category === cat) &&
        (tag === "all" || r.product.collections.includes(tag)) &&
        (!missingAr || arMissing.has(r.product.id)) &&
        (!t || r.product.title.toLowerCase().includes(t) || r.product.handle.includes(t) || (r.product.sku ?? "").toLowerCase().includes(t) || r.product.colors.some((c) => c.name.toLowerCase().includes(t))),
    );
    if (sort.key === "manual") return list;
    const fn = CMP[sort.key];
    return [...list].sort((a, b) => fn(a, b) * sort.dir || a.product.title.localeCompare(b.product.title));
  }, [order, byId, tab, cat, tag, q, sort, missingAr, arMissing]);

  const canDrag = view === "table" && sort.key === "manual" && tab === "all" && cat === "all" && tag === "all" && !missingAr && !q.trim();
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.product.id));

  const commitOrder = async () => {
    const ids = orderRef.current;
    if (ids.join() === committed.current) return;
    committed.current = ids.join();
    const res = await reorderProducts(ids);
    if (!res.ok) return toast.error(tr("catalog.list.toast.orderFailed"), res.error);
    toast.success(tr("catalog.list.toast.orderSaved"), tr("catalog.list.toast.orderSavedBody"));
    startTransition(() => router.refresh());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulkStatus = async (status: ProductStatus, ids = [...selected]) => {
    setBusy(true);
    const res = await setProductsStatus(ids, status);
    setBusy(false);
    if (!res.ok) return toast.error(tr("catalog.list.toast.updateFailed"), res.error);
    toast.success(tr("catalog.list.toast.statusSet", { count: ids.length, status: tr(`catalog.status.${status}`) }));
    setSelected(new Set());
    startTransition(() => router.refresh());
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const res = await deleteProducts(ids);
    if (!res.ok) return toast.error(tr("catalog.list.toast.deleteFailed"), res.error);
    toast.success(tr("catalog.list.toast.deleted", { count: ids.length }));
    setSelected(new Set());
    startTransition(() => router.refresh());
  };

  const duplicate = async (id: string) => {
    const res = await duplicateProduct(id);
    if (!res.ok || !res.data) return toast.error(tr("catalog.list.toast.duplicateFailed"), res.ok ? undefined : res.error);
    toast.success(tr("catalog.list.toast.duplicated"), tr("catalog.list.toast.duplicatedBody"));
    router.push(`/admin/products/${res.data}`);
  };

  const menu = (r: ProductRow): MenuItem[] => {
    const p = r.product;
    const st = p.status ?? "active";
    return [
      { label: tr("common.edit"), icon: "edit", href: `/admin/products/${p.id}` },
      { label: tr("catalog.list.quickEdit"), icon: "bolt", onSelect: () => setQuick(p.id) },
      { label: tr("catalog.list.duplicate"), icon: "copy", onSelect: () => duplicate(p.id) },
      { label: st === "active" ? tr("catalog.list.viewOnStore") : tr("catalog.list.notLive"), icon: "external", href: `/products/${p.handle}`, external: true, disabled: st !== "active" },
      st === "archived" ? { label: tr("catalog.list.restoreDraft"), icon: "refresh", onSelect: () => bulkStatus("draft", [p.id]) } : { label: tr("catalog.list.archive"), icon: "backup", onSelect: () => bulkStatus("archived", [p.id]) },
    ];
  };

  const resetFilters = () => {
    setQ("");
    setCat("all");
    setTag("all");
    setTab("all");
    setMissingAr(false);
  };

  const onQuickSaved = () => {
    setQuick(null);
    startTransition(() => router.refresh());
  };

  return (
    <>
      <PageHeader
        title={tr("catalog.list.title")}
        description={tr("catalog.list.description")}
        actions={
          <LinkButton href="/admin/products/new" variant="primary" icon="plus">
            {tr("catalog.list.add")}
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: tr("common.all"), count: counts.all },
            { value: "active", label: tr("catalog.status.active"), count: counts.active },
            { value: "draft", label: tr("catalog.status.draft"), count: counts.draft },
            { value: "archived", label: tr("catalog.status.archived"), count: counts.archived },
          ]}
        />
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-[180px] flex-1 lg:max-w-[260px]">
            <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
            <Input aria-label={tr("catalog.list.searchLabel")} placeholder={tr("catalog.list.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
          </div>
          <button
            type="button"
            aria-pressed={missingAr}
            onClick={() => setMissingAr((v) => !v)}
            title={tr("common.translation.missing")}
            className={cx("fx-press inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-medium ring-1 ring-inset transition", missingAr ? "bg-a-warn/12 text-a-warn ring-a-warn/30" : "bg-a-panel-2 text-a-dim ring-a-line hover:text-a-text hover:ring-a-line-strong")}
          >
            <AIcon name="globe" size={14} />
            {tr("common.translation.missingArabic")}
            <span className="rounded-full bg-a-ink/[0.07] px-1.5 text-[11px] tabular-nums">{arMissing.size}</span>
          </button>
          <Select aria-label={tr("catalog.list.typeLabel")} value={cat} onChange={(e) => setCat(e.target.value)} className="w-[150px]">
            <option value="all">{tr("catalog.list.allTypes")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("catalog.list.tagLabel")} value={tag} onChange={(e) => setTag(e.target.value)} className="w-[130px]">
            <option value="all">{tr("catalog.list.allTags")}</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            aria-label={tr("common.sort")}
            value={SORTS.some((x) => x.value === `${sort.key}:${sort.dir}`) ? `${sort.key}:${sort.dir}` : "custom"}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":");
              if (key !== "custom") setSort({ key: key as SortKey, dir: Number(dir) as 1 | -1 });
            }}
            className="w-[170px]"
          >
            {!SORTS.some((x) => x.value === `${sort.key}:${sort.dir}`) ? <option value="custom">{tr("catalog.list.sorts.custom")}</option> : null}
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {tr(`catalog.list.sorts.${s.label}`)}
              </option>
            ))}
          </Select>
          <Tabs
            size="sm"
            value={view}
            onChange={setView}
            items={[
              { value: "table", label: <><AIcon name="nav" size={15} /><span className="sr-only">{tr("catalog.list.tableView")}</span></> },
              { value: "grid", label: <><AIcon name="overview" size={15} /><span className="sr-only">{tr("catalog.list.gridView")}</span></> },
            ]}
          />
        </div>
      </div>

      {/* bulk bar */}
      <AnimatePresence initial={false}>
        {selected.size ? (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.22, ease }}
            className="overflow-hidden"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-a-violet/30 bg-a-violet/[0.07] px-3 py-2">
              <span className="me-1 text-[13px] font-medium">{tr("common.selected", { count: selected.size })}</span>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                {tr("common.clear")}
              </Button>
              <span className="mx-1 hidden h-5 w-px bg-a-line sm:block" />
              <Button size="sm" variant="primary" icon="edit" onClick={() => setBulkOpen(true)}>
                {tr("catalog.list.bulkEdit")}
              </Button>
              <Button size="sm" loading={busy} onClick={() => bulkStatus("active")}>
                {tr("catalog.list.setActive")}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => bulkStatus("draft")}>
                {tr("catalog.list.setDraft")}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => bulkStatus("archived")}>
                {tr("catalog.list.archive")}
              </Button>
              <span className="ms-auto">
                <ConfirmButton onConfirm={bulkDelete} confirmLabel={tr("catalog.list.deleteN", { count: selected.size })}>
                  {tr("common.delete")}
                </ConfirmButton>
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!rows.length ? (
        <div className="rounded-2xl border border-a-line bg-a-panel">
          <EmptyState icon="products" title={tr("catalog.list.emptyTitle")} description={tr("catalog.list.emptyBody")} action={<LinkButton href="/admin/products/new" variant="primary" icon="plus">{tr("catalog.list.add")}</LinkButton>} />
        </div>
      ) : !visible.length ? (
        <div className="rounded-2xl border border-a-line bg-a-panel">
          <EmptyState icon="search" title={tr("catalog.list.noMatchTitle")} description={tr("catalog.list.noMatchBody")} action={<Button onClick={resetFilters}>{tr("catalog.list.clearFilters")}</Button>} />
        </div>
      ) : (
        <LayoutGroup>
          {view === "table" ? (
            <div className="rounded-2xl border border-a-line bg-a-panel">
              <div className={cx("grid items-center gap-3 border-b border-a-line px-3 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint md:px-4", COLS)}>
                <Checkbox checked={allChecked} onChange={(v) => setSelected(v ? new Set(visible.map((r) => r.product.id)) : new Set())} label={<span className="sr-only">{tr("catalog.list.selectAll")}</span>} />
                <span className="hidden md:block" />
                <SortHead label={tr("catalog.list.cols.product")} k="title" sort={sort} onSort={sortBy} />
                <SortHead label={tr("catalog.list.cols.status")} k="status" sort={sort} onSort={sortBy} className="hidden md:flex" />
                <span className="hidden md:block">{tr("catalog.list.cols.colours")}</span>
                <SortHead label={tr("catalog.list.cols.stock")} k="stock" sort={sort} onSort={sortBy} className="hidden md:flex" />
                <SortHead label={tr("catalog.list.cols.price")} k="price" sort={sort} onSort={sortBy} className="hidden md:flex" />
                <SortHead label={tr("catalog.list.cols.sold")} k="sold" sort={sort} onSort={sortBy} className="hidden justify-end md:flex" />
                <span />
              </div>
              {!canDrag ? (
                <p className="flex items-center gap-1.5 border-b border-a-line px-4 py-2 text-[12px] text-a-faint">
                  <AIcon name="info" size={13} /> {tr("catalog.list.dragHint")}
                  {sort.key !== "manual" ? (
                    <button type="button" onClick={() => setSort({ key: "manual", dir: 1 })} className="ms-1 text-a-accent hover:underline">
                      {tr("catalog.list.resetSort")}
                    </button>
                  ) : null}
                </p>
              ) : null}
              <Reorder.Group as="div" axis="y" values={visible.map((r) => r.product.id)} onReorder={(ids: string[]) => canDrag && applyOrder(ids)}>
                <AnimatePresence initial={false}>
                  {visible.map((r, i) => (
                    <SortableItem
                      key={r.product.id}
                      value={r.product.id}
                      index={i}
                      count={visible.length}
                      disabled={!canDrag}
                      onMove={(from, to) => applyOrder(move(orderRef.current, from, to))}
                      onCommit={commitOrder}
                      className="border-b border-a-line/70 bg-a-panel last:rounded-b-2xl last:border-0 has-[[aria-expanded=true]]:z-20"
                    >
                      {(handle) =>
                        quick === r.product.id ? (
                          <QuickEdit r={r} categories={categories} allTags={allTags} onCancel={() => setQuick(null)} onSaved={onQuickSaved} />
                        ) : (
                          <TableRow
                            r={r}
                            handle={handle}
                            checked={selected.has(r.product.id)}
                            onCheck={() => toggle(r.product.id)}
                            menu={menu(r)}
                            onQuick={() => setQuick(r.product.id)}
                            onDuplicate={() => duplicate(r.product.id)}
                            onArchive={() => bulkStatus((r.product.status ?? "active") === "archived" ? "draft" : "archived", [r.product.id])}
                          />
                        )
                      }
                    </SortableItem>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              <AnimatePresence initial={false}>
                {visible.map((r) => (
                  <GridCard key={r.product.id} r={r} checked={selected.has(r.product.id)} onCheck={() => toggle(r.product.id)} menu={menu(r)} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </LayoutGroup>
      )}
      <BulkEditDrawer
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        ids={[...selected]}
        rows={rows}
        allTags={allTags}
        onDone={() => {
          setBulkOpen(false);
          setSelected(new Set());
          startTransition(() => router.refresh());
        }}
      />
      <p className="mt-3 text-[12px] text-a-faint">
        {tr("catalog.list.footer", { shown: visible.length, count: rows.length })}
      </p>
    </>
  );
}

function StockCell({ r }: { r: ProductRow }) {
  const { t } = useT();
  const low = lowSizes(r.product);
  if (r.stock === 0) return <Badge tone="red" dot>{t("catalog.list.outOfStock")}</Badge>;
  return (
    <span className="flex items-center gap-1.5 tabular-nums" title={low.length ? t("catalog.list.lowTitle", { sizes: low.map((s) => `${s.label} (${s.stock})`).join(", ") }) : undefined}>
      <span className={cx(low.length ? "text-a-warn" : "text-a-text")}>{r.stock.toLocaleString("en")}</span>
      <span className="text-a-faint">{t("catalog.list.inStockWord")}</span>
      {low.length ? (
        <span className="text-a-warn" aria-label={t("catalog.list.lowSizes", { count: low.length, n: LOW_STOCK })}>
          <AIcon name="alert" size={14} />
        </span>
      ) : null}
    </span>
  );
}

function Price({ price, compareAt }: { price: number; compareAt?: number }) {
  const off = pctOff(price, compareAt);
  return (
    <span dir="ltr" className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums rtl:justify-end">
      <span className="font-medium">{egp(price)}</span>
      {off ? <s className="text-[12px] text-a-faint">{egp(compareAt!)}</s> : null}
    </span>
  );
}

function TableRow({ r, handle, checked, onCheck, menu, onQuick, onDuplicate, onArchive }: { r: ProductRow; handle: React.ReactNode; checked: boolean; onCheck: () => void; menu: MenuItem[]; onQuick: () => void; onDuplicate: () => void; onArchive: () => void }) {
  const { t } = useT();
  const p = r.product;
  const st = p.status ?? "active";
  const tc = productCompleteness(p);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cx("group grid items-center gap-3 px-3 py-2.5 text-[13px] transition-colors hover:bg-a-violet/[0.045] md:px-4", COLS, checked && "bg-a-violet/[0.05]")}
    >
      <Checkbox checked={checked} onChange={onCheck} label={<span className="sr-only">{t("catalog.list.selectOne", { title: p.title })}</span>} />
      <span className="hidden md:block">{handle}</span>
      <div className="flex min-w-0 items-center gap-3">
        <Link href={`/admin/products/${p.id}`} tabIndex={-1} aria-hidden className="shrink-0 rounded-lg">
          <motion.span layoutId={`thumb-${p.id}`} className="block shrink-0">
            <Thumb src={p.colors[0]?.images[0]} className="h-12 w-[38px]" sizes="40px" />
          </motion.span>
        </Link>
        <span className="min-w-0 flex-1">
          <Link href={`/admin/products/${p.id}`} className="block truncate font-medium hover:text-a-accent">
            {p.title}
          </Link>
          {/* meta line and hover actions share one grid cell (swap visibility, not display) → no row reflow on hover */}
          <span className="mt-0.5 grid items-center [&>*]:col-start-1 [&>*]:row-start-1">
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-a-faint md:group-hover:invisible md:group-focus-within:invisible">
            <span className="truncate">{p.category}</span>
            <span className="md:hidden">
              <Badge tone={statusTone[st]}>{t(`catalog.status.${st}`)}</Badge>
            </span>
            {p.badge ? <span className="hidden truncate text-a-accent lg:inline">· {p.badge}</span> : null}
            <TranslationMeter done={tc.done} total={tc.total} compact className="h-[18px] px-1.5 text-[10.5px]" />
          </span>
          {/* WordPress / Shopify-style row actions on hover */}
          <span className="hidden min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] md:invisible md:flex md:group-hover:visible md:group-focus-within:visible">
            <Link href={`/admin/products/${p.id}`} className="text-a-accent hover:underline">
              {t("common.edit")}
            </Link>
            <span className="text-a-faint">|</span>
            <button type="button" onClick={onQuick} className="text-a-accent hover:underline">
              {t("catalog.list.quickEdit")}
            </button>
            <span className="text-a-faint">|</span>
            <button type="button" onClick={onDuplicate} className="text-a-accent hover:underline">
              {t("catalog.list.duplicate")}
            </button>
            {st === "active" ? (
              <>
                <span className="text-a-faint">|</span>
                <a href={`/products/${p.handle}`} target="_blank" rel="noopener noreferrer" className="text-a-accent hover:underline">
                  {t("common.view")}
                </a>
              </>
            ) : null}
            <span className="text-a-faint">|</span>
            <button type="button" onClick={onArchive} className={st === "archived" ? "text-a-accent hover:underline" : "text-a-danger/90 hover:underline"}>
              {st === "archived" ? t("catalog.list.restore") : t("catalog.list.archive")}
            </button>
          </span>
          </span>
          <span className="mt-1 flex items-center gap-2 text-[12px] md:hidden">
            <Ltr className="font-medium tabular-nums">{egp(p.price)}</Ltr>
            <span className={cx("tabular-nums", r.stock <= LOW_STOCK ? "text-a-danger" : lowSizes(p).length ? "text-a-warn" : "text-a-faint")}>{t("catalog.list.inStock", { count: r.stock })}</span>
          </span>
        </span>
      </div>
      <span className="hidden md:block">
        <Badge tone={statusTone[st]} dot>
          {t(`catalog.status.${st}`)}
        </Badge>
      </span>
      <span className="hidden items-center gap-2 md:flex">
        <Swatches colors={p.colors} max={4} />
        <span className="text-[12px] text-a-faint">{p.colors.length}</span>
      </span>
      <span className="hidden md:block">
        <StockCell r={r} />
      </span>
      <span className="hidden md:block">
        <Price price={p.price} compareAt={p.compareAt} />
      </span>
      <span className="hidden text-end tabular-nums text-a-dim md:block">{r.sold.toLocaleString("en")}</span>
      <RowMenu items={menu} label={t("catalog.list.actionsFor", { title: p.title })} />
    </motion.div>
  );
}

function GridCard({ r, checked, onCheck, menu }: { r: ProductRow; checked: boolean; onCheck: () => void; menu: MenuItem[] }) {
  const { t } = useT();
  const p = r.product;
  const st = p.status ?? "active";
  const off = pctOff(p.price, p.compareAt);
  const tc = productCompleteness(p);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease }}
      className="group relative rounded-2xl has-[[aria-expanded=true]]:z-20"
    >
      <Tilt3D max={7} scale={1.02} className={cx("fx-spot rounded-2xl border bg-a-panel p-2.5 transition-[border-color,box-shadow] duration-300 hover:shadow-[0_24px_50px_-28px_var(--a-shadow)]", checked ? "border-a-violet/50" : "border-a-line hover:border-a-line-strong")}>
      <Link href={`/admin/products/${p.id}`} className="block rounded-xl" aria-label={t("catalog.list.editOne", { title: p.title })}>
        <motion.span layoutId={`thumb-${p.id}`} className="block">
          <Thumb src={p.colors[0]?.images[0]} alt="" className="aspect-[4/5] w-full" rounded="rounded-xl" sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 45vw" />
        </motion.span>
      </Link>
      <div className="absolute start-4 top-4 z-[5] flex items-center gap-1.5" style={{ "--z": "28px" } as React.CSSProperties} data-z>
        <span className="rounded-md bg-a-panel/85 p-1 backdrop-blur">
          <Checkbox checked={checked} onChange={onCheck} label={<span className="sr-only">{t("catalog.list.selectOne", { title: p.title })}</span>} />
        </span>
      </div>
      <div className="absolute end-4 top-4 z-[5] flex items-center gap-1.5" style={{ "--z": "36px" } as React.CSSProperties} data-z>
        {off ? <span dir="ltr" className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#c2410c]">−{off}%</span> : null}
        <Badge tone={statusTone[st]} className="bg-a-panel/90 backdrop-blur">
          {t(`catalog.status.${st}`)}
        </Badge>
      </div>
      <div className="px-1 pb-0.5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate text-[13.5px] font-medium">
            {p.title}
          </Link>
          <div className="-me-1 -mt-1.5">
            <RowMenu items={menu} label={t("catalog.list.actionsFor", { title: p.title })} />
          </div>
        </div>
        <div className="mt-0.5">
          <Price price={p.price} compareAt={p.compareAt} />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[12px]">
          <Swatches colors={p.colors} max={5} />
          <span className={cx("tabular-nums", r.stock === 0 ? "text-a-danger" : lowSizes(p).length ? "text-a-warn" : "text-a-faint")}>{t("catalog.list.inStock", { count: r.stock })}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-a-faint tabular-nums">
          <span>{t("catalog.list.soldN", { count: r.sold })}</span>
          <TranslationMeter done={tc.done} total={tc.total} compact className="h-[18px] px-1.5 text-[10.5px]" />
        </div>
      </div>
      </Tilt3D>
    </motion.div>
  );
}

/* ───────────── sortable column header ───────────── */

function SortHead({ label, k, sort, onSort, className }: { label: string; k: Exclude<SortKey, "manual">; sort: Sort; onSort: (k: Exclude<SortKey, "manual">) => void; className?: string }) {
  const { t } = useT();
  const on = sort.key === k;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-label={on ? t(sort.dir === 1 ? "catalog.list.sortByAsc" : "catalog.list.sortByDesc", { label }) : t("catalog.list.sortBy", { label })}
      className={cx("group/sort flex items-center gap-1 text-start uppercase tracking-[0.06em] transition hover:text-a-text", on && "text-a-text", className)}
    >
      {label}
      <motion.span animate={{ rotate: on && sort.dir === -1 ? 180 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.2, ease }} className="grid group-hover/sort:!opacity-60">
        <AIcon name="chevronUp" size={12} strokeWidth={2.4} />
      </motion.span>
    </button>
  );
}

/* ───────────── Quick edit (WordPress-style inline panel) ───────────── */

function QuickEdit({ r, categories, allTags, onCancel, onSaved }: { r: ProductRow; categories: string[]; allTags: string[]; onCancel: () => void; onSaved: () => void }) {
  const { t: tr } = useT();
  const p = r.product;
  const [title, setTitle] = useState(p.title);
  const [status, setStatus] = useState<ProductStatus>(p.status ?? "active");
  const [price, setPrice] = useState(String(p.price));
  const [compareAt, setCompareAt] = useState(p.compareAt ? String(p.compareAt) : "");
  const [category, setCategory] = useState(p.category);
  const [tags, setTags] = useState<string[]>(p.collections);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const priceN = Number(price);
  const cmpN = compareAt.trim() ? Number(compareAt) : undefined;
  const error = !title.trim() ? tr("catalog.list.qe.titleRequired") : !(priceN > 0) ? tr("catalog.list.qe.enterPrice") : cmpN !== undefined && !(cmpN > priceN) ? tr("catalog.list.qe.compareHigher") : null;

  const addTag = (t: string) => {
    const v = t.trim().toLowerCase();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  };
  const save = async () => {
    if (error) return toast.error(error);
    setSaving(true);
    const res = await quickEditProduct(p.id, { title, status, price: priceN, compareAt: cmpN ?? null, category, tags });
    setSaving(false);
    if (!res.ok) return toast.error(tr("catalog.list.qe.failed"), res.error);
    toast.success(tr("catalog.list.qe.updated"), status === "active" ? tr("catalog.list.qe.live") : undefined);
    onSaved();
  };
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease }}
      className="overflow-hidden bg-a-violet/[0.05]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") (e.preventDefault(), e.stopPropagation(), save());
      }}
    >
      <div className="px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <Thumb src={p.colors[0]?.images[0]} className="h-10 w-8" sizes="32px" />
          <p className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint">{tr("catalog.list.quickEdit")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label={tr("catalog.list.qe.title")} htmlFor={`qe-t-${p.id}`}>
            <Input id={`qe-t-${p.id}`} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={tr("catalog.list.cols.status")} htmlFor={`qe-s-${p.id}`}>
            <Select id={`qe-s-${p.id}`} value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
              <option value="active">{tr("catalog.status.active")}</option>
              <option value="draft">{tr("catalog.status.draft")}</option>
              <option value="archived">{tr("catalog.status.archived")}</option>
            </Select>
          </Field>
          <Field label={tr("catalog.list.cols.price")} htmlFor={`qe-p-${p.id}`}>
            <Input id={`qe-p-${p.id}`} type="number" min={1} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix="EGP" />
          </Field>
          <Field label={tr("catalog.list.qe.compareAt")} htmlFor={`qe-c-${p.id}`} error={cmpN !== undefined && !(cmpN > priceN) ? tr("catalog.list.qe.aboveprice") : undefined}>
            <Input id={`qe-c-${p.id}`} type="number" min={0} inputMode="decimal" placeholder="—" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} suffix="EGP" />
          </Field>
          <Field label={tr("catalog.list.typeLabel")} htmlFor={`qe-type-${p.id}`}>
            <Input id={`qe-type-${p.id}`} list={`qe-types-${p.id}`} value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id={`qe-types-${p.id}`}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label={tr("catalog.list.qe.tags")} htmlFor={`qe-tags-${p.id}`} className="md:col-span-3">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-[10px] bg-a-panel px-2 py-1 ring-1 ring-a-line has-[input:focus]:ring-a-accent">
              <AnimatePresence initial={false}>
                {tags.map((t) => (
                  <motion.span key={t} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}>
                    <Chip onRemove={() => setTags(tags.filter((x) => x !== t))}>{t}</Chip>
                  </motion.span>
                ))}
              </AnimatePresence>
              <input
                id={`qe-tags-${p.id}`}
                list={`qe-taglist-${p.id}`}
                value={tagInput}
                placeholder={tags.length ? "" : tr("catalog.list.qe.addTags")}
                onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value.slice(0, -1)) : setTagInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.preventDefault(), addTag(tagInput));
                  if (e.key === "Backspace" && !tagInput && tags.length) setTags(tags.slice(0, -1));
                }}
                onBlur={() => tagInput && addTag(tagInput)}
                className="h-7 min-w-[100px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-a-faint"
              />
              <datalist id={`qe-taglist-${p.id}`}>
                {allTags.filter((t) => !tags.includes(t)).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="primary" loading={saving} onClick={save}>
            {tr("catalog.list.qe.update")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {tr("common.cancel")}
          </Button>
          {p.variants?.some((v) => v.price !== undefined) ? <span className="ms-2 text-[12px] text-a-faint">{tr("catalog.list.qe.variantPrices")}</span> : null}
        </div>
      </div>
    </motion.div>
  );
}

/* ───────────── Bulk edit drawer ───────────── */

const BULK_BLANK = { status: "" as "" | ProductStatus, addTags: [] as string[], removeTags: [] as string[], priceMode: "pct" as "pct" | "fixed", priceDir: "down" as "up" | "down", priceValue: "", cmpMode: "keep" as NonNullable<BulkEditInput["compareAt"]>["mode"], cmpValue: "" };

function BulkEditDrawer({ open, onClose, ids, rows, allTags, onDone }: { open: boolean; onClose: () => void; ids: string[]; rows: ProductRow[]; allTags: string[]; onDone: () => void }) {
  const { t: tr } = useT();
  const [f, setF] = useState(BULK_BLANK);
  const [tagIn, setTagIn] = useState("");
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setF(BULK_BLANK);
  }
  const set = <K extends keyof typeof BULK_BLANK>(k: K, v: (typeof BULK_BLANK)[K]) => setF((x) => ({ ...x, [k]: v }));
  const chosen = rows.filter((r) => ids.includes(r.product.id));
  const selTags = [...new Set(chosen.flatMap((r) => r.product.collections))].sort();
  const pv = Number(f.priceValue);
  const preview = (n: number) => {
    if (!(pv > 0)) return n;
    const dir = f.priceDir === "up" ? 1 : -1;
    return Math.max(1, Math.round(f.priceMode === "pct" ? n * (1 + (dir * Math.min(95, pv)) / 100) : n + dir * pv));
  };
  const changes = (f.status ? 1 : 0) + f.addTags.length + f.removeTags.length + (pv > 0 ? 1 : 0) + (f.cmpMode !== "keep" ? 1 : 0);

  const apply = async () => {
    setSaving(true);
    const res = await bulkEditProducts(ids, {
      status: f.status || undefined,
      addTags: f.addTags,
      removeTags: f.removeTags,
      price: pv > 0 ? { mode: f.priceMode, dir: f.priceDir, value: pv } : undefined,
      compareAt: { mode: f.cmpMode, value: f.cmpMode === "set" ? Number(f.cmpValue) : undefined },
    });
    setSaving(false);
    if (!res.ok) return toast.error(tr("catalog.list.bulk.failed"), res.error);
    toast.success(tr("catalog.list.bulk.updated", { count: res.data?.updated ?? 0 }), tr("catalog.list.bulk.live"));
    onDone();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-[560px]"
      title={tr("catalog.list.bulk.title", { count: ids.length })}
      footer={
        <>
          <span className="me-auto text-[12.5px] text-a-faint">{changes ? tr("catalog.list.bulk.changes", { count: changes }) : tr("catalog.list.bulk.nothing")}</span>
          <Button variant="ghost" onClick={onClose}>
            {tr("common.cancel")}
          </Button>
          <Button variant="primary" loading={saving} disabled={!changes} onClick={apply}>
            {tr("catalog.list.bulk.applyTo", { count: ids.length })}
          </Button>
        </>
      }
    >
      <div className="grid gap-6">
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {chosen.slice(0, 10).map((r) => (
            <Thumb key={r.product.id} src={r.product.colors[0]?.images[0]} className="h-11 w-9 ring-2 ring-a-panel" sizes="36px" />
          ))}
          {chosen.length > 10 ? <span className="grid h-11 w-9 place-items-center rounded-lg bg-a-panel-2 text-[11px] text-a-dim ring-2 ring-a-panel">+{chosen.length - 10}</span> : null}
        </div>

        <Field label={tr("catalog.list.cols.status")} htmlFor="be-status">
          <Select id="be-status" value={f.status} onChange={(e) => set("status", e.target.value as "" | ProductStatus)}>
            <option value="">{tr("catalog.list.bulk.dontChange")}</option>
            <option value="active">{tr("catalog.status.active")}</option>
            <option value="draft">{tr("catalog.status.draft")}</option>
            <option value="archived">{tr("catalog.status.archived")}</option>
          </Select>
        </Field>

        <div className="grid gap-2">
          <p className="text-[12.5px] font-medium text-a-dim">{tr("catalog.list.bulk.addTags")}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {f.addTags.map((t) => (
              <Chip key={t} active onRemove={() => set("addTags", f.addTags.filter((x) => x !== t))}>
                {t}
              </Chip>
            ))}
            <Input
              aria-label={tr("catalog.list.bulk.tagToAdd")}
              list="be-tags"
              placeholder={tr("catalog.list.bulk.tagPlaceholder")}
              value={tagIn}
              onChange={(e) => setTagIn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = tagIn.trim().toLowerCase();
                  if (v && !f.addTags.includes(v)) set("addTags", [...f.addTags, v]);
                  setTagIn("");
                }
              }}
              className="h-8 max-w-[240px]"
            />
            <datalist id="be-tags">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        {selTags.length ? (
          <div className="grid gap-2">
            <p className="text-[12.5px] font-medium text-a-dim">{tr("catalog.list.bulk.removeTags")}</p>
            <div className="flex flex-wrap gap-1.5">
              {selTags.map((t) => (
                <Chip key={t} active={f.removeTags.includes(t)} onClick={() => set("removeTags", f.removeTags.includes(t) ? f.removeTags.filter((x) => x !== t) : [...f.removeTags, t])}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="text-[12.5px] font-medium text-a-dim">{tr("catalog.list.bulk.adjustPrice")}</p>
          <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2">
            <Select aria-label={tr("catalog.list.bulk.direction")} value={f.priceDir} onChange={(e) => set("priceDir", e.target.value as "up" | "down")}>
              <option value="down">{tr("catalog.list.bulk.decrease")}</option>
              <option value="up">{tr("catalog.list.bulk.increase")}</option>
            </Select>
            <Select aria-label={tr("catalog.list.bulk.adjustBy")} value={f.priceMode} onChange={(e) => set("priceMode", e.target.value as "pct" | "fixed")}>
              <option value="pct">{tr("catalog.list.bulk.percent")}</option>
              <option value="fixed">{tr("catalog.list.bulk.fixed")}</option>
            </Select>
            <Input aria-label={tr("catalog.list.bulk.amount")} type="number" min={0} inputMode="decimal" placeholder="0" value={f.priceValue} onChange={(e) => set("priceValue", e.target.value)} suffix={f.priceMode === "pct" ? "%" : "EGP"} />
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-[12.5px] font-medium text-a-dim">{tr("catalog.list.bulk.compareAt")}</p>
          <div className="grid grid-cols-[1.4fr_1fr] gap-2">
            <Select aria-label={tr("catalog.list.qe.compareAt")} value={f.cmpMode} onChange={(e) => set("cmpMode", e.target.value as typeof f.cmpMode)}>
              <option value="keep">{tr("catalog.list.bulk.dontChange")}</option>
              <option value="original">{tr("catalog.list.bulk.cmpOriginal")}</option>
              <option value="set">{tr("catalog.list.bulk.cmpSet")}</option>
              <option value="clear">{tr("catalog.list.bulk.cmpClear")}</option>
            </Select>
            {f.cmpMode === "set" ? <Input aria-label={tr("catalog.list.bulk.compareAt")} type="number" min={1} value={f.cmpValue} onChange={(e) => set("cmpValue", e.target.value)} suffix="EGP" /> : <span />}
          </div>
        </div>

        {pv > 0 || f.cmpMode !== "keep" ? (
          <div className="rounded-xl border border-a-line">
            <p className="border-b border-a-line px-3 py-2 text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint">{tr("common.preview")}</p>
            <ul className="a-scroll max-h-56 divide-y divide-a-line/70 overflow-y-auto">
              {chosen.map((r) => {
                const np = preview(r.product.price);
                const nc = f.cmpMode === "clear" ? undefined : f.cmpMode === "set" ? Number(f.cmpValue) || undefined : f.cmpMode === "original" ? Math.max(r.product.price, r.product.compareAt ?? 0) : r.product.compareAt;
                return (
                  <li key={r.product.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate">{r.product.title}</span>
                    <bdi dir="ltr" className="tabular-nums text-a-faint line-through decoration-a-faint/60">{np !== r.product.price ? egp(r.product.price) : ""}</bdi>
                    <bdi dir="ltr" className="tabular-nums font-medium">{egp(np)}</bdi>
                    {nc && nc > np ? <s dir="ltr" className="tabular-nums text-a-faint">{egp(nc)}</s> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
