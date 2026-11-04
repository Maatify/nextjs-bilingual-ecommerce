"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteProduct, duplicateProduct, saveProduct } from "@/app/admin/(panel)/products/actions";
import { cx, money, pctOff } from "@/lib/format";
import { descriptionHtml } from "@/lib/rich-text";
import { productCompleteness } from "@/lib/i18n/admin/completeness";
import type { AdminLocale, TFn } from "@/lib/i18n/admin";
import type { FitTendency, Product, ProductAr, ProductStatus, SizeChartKind } from "@/lib/types";
import { isTracked, normalizeVariants, priceRange } from "@/lib/variants";
import type { AssignableCollection } from "@/server/queries/catalog";
import { AIcon, type AIconName } from "../icons";
import { ArChip, ContentLangTabs, Ltr, TranslationMeter, arProps, useT } from "../i18n";
import { Badge, Button, Card, Drawer, Field, Input, markOpened, Modal, Select, SaveBar, Switch, Textarea, egp, ease, toast, useDraft } from "../ui";
import { MediaCard } from "./editor/media-card";
import { OrganizationCard } from "./editor/organization-card";
import { RichTextEditor } from "./editor/rich-text-editor";
import { VariantsCard } from "./editor/variants-card";
import { ListEditor } from "./list-editor";
import { ProductCardPreview } from "./product-preview";
import { AR_COLOUR_NAMES } from "./colour-media";
import { HANDLE_RE, slugify, statusTone } from "./shared";

export interface EditorOptions {
  categories: string[];
  tags: string[];
  tagTitles: Record<string, string>;
  handles: { id: string; handle: string }[];
  collections?: AssignableCollection[];
}

type Errors = Partial<Record<"title" | "handle" | "price" | "compareAt" | "colors" | "sizes" | "fitSplit" | "category", string>>;

function validate(p: Product, handles: EditorOptions["handles"], t: TFn): Errors {
  const e: Errors = {};
  if (!p.title.trim()) e.title = t("products.errors.title");
  if (!p.handle) e.handle = t("products.errors.handleRequired");
  else if (!HANDLE_RE.test(p.handle)) e.handle = t("products.errors.handleFormat");
  else if (handles.some((h) => h.handle === p.handle && h.id !== p.id)) e.handle = t("products.errors.handleTaken");
  if (!(p.price > 0)) e.price = t("products.errors.price");
  if (p.compareAt !== undefined && p.compareAt <= p.price) e.compareAt = t("products.errors.compareAt");
  if (!p.category.trim()) e.category = t("products.errors.category");
  if (!p.colors.length) e.colors = t("products.errors.colorsNone");
  else if (p.colors.some((c) => !c.name.trim())) e.colors = t("products.errors.colorName");
  else if (new Set(p.colors.map((c) => c.name.trim().toLowerCase())).size !== p.colors.length) e.colors = t("products.errors.colorUnique");
  else if (p.colors.some((c) => !/^#[0-9a-f]{6}$/i.test(c.hex))) e.colors = t("products.errors.colorHex");
  if (!p.sizes.length) e.sizes = t("products.errors.sizesNone");
  else if (p.sizes.some((s) => !s.label.trim())) e.sizes = t("products.errors.sizeLabel");
  else if (new Set(p.sizes.map((s) => s.label.trim().toUpperCase())).size !== p.sizes.length) e.sizes = t("products.errors.sizeUnique");
  if (p.fitSplit.reduce((a, b) => a + b, 0) !== 100) e.fitSplit = t("products.errors.fitSplit");
  return e;
}

/** Set one Arabic field; empty values are dropped so an untouched translation stays `undefined` (no false "unsaved"). */
function withAr<K extends keyof ProductAr>(p: Product, key: K, value: ProductAr[K]): Product {
  const ar: ProductAr = { ...p.ar };
  const empty = value === undefined || (typeof value === "string" && !value) || (Array.isArray(value) && !value.length) || (typeof value === "object" && value !== null && !Array.isArray(value) && !Object.keys(value).length);
  if (empty) delete ar[key];
  else ar[key] = value;
  return { ...p, ar: Object.keys(ar).length ? ar : undefined };
}

const optNum = (v: string) => (v === "" ? undefined : Math.max(0, Number(v)));

interface Draft {
  p: Product;
  /** manual collections (handles) this product is in */
  manual: string[];
}

export function ProductEditor({ product, isNew, options, sold = 0 }: { product: Product; isNew: boolean; options: EditorOptions; sold?: number }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const [cl, setCl] = useState<AdminLocale>("en");
  const isAr = cl === "ar";
  const collections = useMemo(() => options.collections ?? [], [options.collections]);
  const base = useMemo<Draft>(
    () => ({ p: normalizeVariants(product), manual: collections.filter((c) => c.type === "manual" && c.productIds?.includes(product.id)).map((c) => c.handle) }),
    [product, collections],
  );
  const [d, setD, dirty, discard] = useDraft(base);
  const p = d.p;
  const setP = (fn: (x: Product) => Product) => setD((x) => ({ ...x, p: fn(x.p) }));
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [handleTouched, setHandleTouched] = useState(!isNew);
  const [seoOpen, setSeoOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Product>(key: K, value: Product[K]) => setP((x) => ({ ...x, [key]: value }));
  const setAr = <K extends keyof ProductAr>(key: K, value: ProductAr[K]) => setP((x) => withAr(x, key, value));
  const ar = p.ar ?? {};
  const tr = productCompleteness(p);
  const enHint = (v?: string) => (v?.trim() ? t("common.translation.englishValue", { value: v.length > 90 ? `${v.slice(0, 90)}…` : v }) : t("common.translation.fallbackHint"));
  const errors = useMemo(() => validate(p, options.handles, t), [p, options.handles, t]);
  const show = (k: keyof Errors) => (tried || k === "handle" || k === "compareAt" ? errors[k] : undefined);
  const status = p.status ?? "active";
  const live = !isNew && product.status === "active";

  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length) {
      if (errors.handle) setSeoOpen(true);
      toast.error(t("products.errors.checkFields"), Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    const res = await saveProduct(p, { create: isNew, manualCollections: collections.length ? d.manual : undefined });
    setSaving(false);
    if (!res.ok) return toast.error(t("products.toast.couldntSave"), res.error);
    toast.success(isNew ? t("products.toast.created") : t("products.toast.saved"), status === "active" ? t("products.toast.liveNow") : t("products.toast.savedAs", { status: t(`products.status.${status}`) }));
    setTried(false);
    if (isNew) {
      const to = `/admin/products/${res.data?.id ?? p.id}`;
      markOpened(to); // same editor at its new URL — don't replay the page-open animation
      router.replace(to);
    }
    else router.refresh();
  };

  const remove = async () => {
    const res = await deleteProduct(p.id);
    if (!res.ok) return toast.error(t("products.toast.couldntDelete"), res.error);
    toast.success(t("products.toast.deleted"), product.title);
    router.push("/admin/products");
  };

  const duplicate = async () => {
    if (dirty) return toast.info(t("products.toast.saveFirst"), t("products.toast.saveFirstBody"));
    const res = await duplicateProduct(p.id);
    if (!res.ok || !res.data) return toast.error(t("products.toast.couldntDuplicate"), res.ok ? undefined : res.error);
    toast.success(t("products.toast.duplicated"));
    router.push(`/admin/products/${res.data}`);
  };

  const margin = p.cost && p.price ? ((p.price - p.cost) / p.price) * 100 : null;
  const off = pctOff(p.price, p.compareAt);
  const lTitle = isAr ? ar.title || p.title : p.title;
  const lCategory = isAr ? ar.category || p.category : p.category;
  const lTagline = isAr ? ar.tagline || p.tagline : p.tagline;
  const seoTitle = (isAr ? ar.seoTitle || p.seoTitle : p.seoTitle) || `${lTitle || t("products.seo.productTitle")} — ${lCategory || t("products.seo.category")}`;
  const ratingText = p.reviewCount > 0 ? ` ${p.reviewCount === 1 ? t("products.seo.ratingOne", { rating: p.rating }) : t("products.seo.rating", { rating: p.rating, count: p.reviewCount })}.` : "";
  const seoDesc = (isAr ? ar.seoDescription || p.seoDescription : p.seoDescription) || `${lTagline} ${money(p.price || 0)}${p.compareAt ? ` ${t("products.seo.was", { price: money(p.compareAt) })}` : ""}.${ratingText}`;
  const fitSum = p.fitSplit.reduce((a, b) => a + b, 0);
  const tracked = isTracked(p);
  const units = (p.variants ?? []).reduce((n, v) => n + v.stock, 0);
  const allTags = useMemo(() => [...new Set([...options.tags, ...p.collections])].sort(), [options.tags, p.collections]);

  const more: { label: string; icon: AIconName; onSelect?: () => void; href?: string; danger?: boolean; hidden?: boolean }[] = [
    { label: t("products.header.viewOnStore"), icon: "external", href: `/products/${product.handle}`, hidden: !live },
    { label: status === "archived" ? t("products.header.unarchive") : t("products.header.archive"), icon: "layers", onSelect: () => set("status", status === "archived" ? "draft" : "archived"), hidden: isNew },
    { label: t("products.header.deleteProduct"), icon: "trash", onSelect: () => setConfirmDelete(true), danger: true, hidden: isNew },
  ];

  return (
    <>
      {/* ─────────── sticky header (Shopify-style) ─────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
        className="sticky top-0 z-30 -mx-4 -mt-7 mb-6 border-b border-a-line bg-a-bg/85 px-4 py-3 backdrop-blur-md md:-mx-8 md:-mt-9 md:px-8"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/admin/products" aria-label={t("products.header.back")} className="grid size-8 shrink-0 place-items-center rounded-[9px] text-a-dim ring-1 ring-a-line transition hover:bg-a-panel-2 hover:text-a-text">
            <AIcon name="chevronLeft" size={16} className="rtl:rotate-180" />
          </Link>
          <h1 className="flex min-w-0 flex-1 basis-[220px] items-center gap-2.5 text-[19px] font-semibold tracking-[-0.015em]">
            <span className="truncate">{p.title || (isNew ? t("products.header.addProduct") : t("common.untitled"))}</span>
            <Badge tone={statusTone[status]} dot>
              {t(`products.status.${status}`)}
            </Badge>
          </h1>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <TranslationMeter done={tr.done} total={tr.total} compact className="hidden sm:inline-flex" />
            <ContentLangTabs value={cl} onChange={setCl} arDone={tr.done} arTotal={tr.total} />
            {!isNew ? (
              <Button size="sm" variant="ghost" icon="copy" onClick={duplicate}>
                <span className="hidden sm:inline">{t("products.header.duplicate")}</span>
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" icon="eye" onClick={() => setPreview(true)}>
              <span className="hidden sm:inline">{t("products.header.preview")}</span>
            </Button>
            {more.some((m) => !m.hidden) ? <MoreActions items={more.filter((m) => !m.hidden)} /> : null}
            <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!dirty && !isNew}>
              {isNew ? t("products.header.saveProduct") : t("common.save")}
            </Button>
          </div>
        </div>
        {!isNew ? (
          <p className="mt-1 ps-11 text-[12px] text-a-faint">
            {tracked ? t("products.header.inStock", { count: units, variants: (p.variants ?? []).length }) : t("products.header.notTracked")} · {t("products.header.sold", { count: sold })} · {t("products.header.id", { id: "" })}
            <Ltr>{p.id}</Ltr>
          </p>
        ) : null}
      </motion.div>

      <div className="grid gap-5 pb-24 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ─────────── main column ─────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="min-w-0 space-y-5">
          <AnimatePresence initial={false}>
            {isAr ? (
              <motion.p
                key="ar-banner"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease }}
                className="flex items-start gap-2 overflow-hidden rounded-xl bg-a-violet/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-a-dim ring-1 ring-a-violet/20"
              >
                <AIcon name="globe" size={14} className="mt-0.5 shrink-0 text-a-accent" />
                <span className="flex-1">{t("products.lang.arabicBanner")}</span>
                <TranslationMeter done={tr.done} total={tr.total} />
              </motion.p>
            ) : null}
          </AnimatePresence>

          <Card>
            <motion.div key={cl} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease }} className="grid gap-4">
              {isAr ? (
                <>
                  <Field label={<ArLabel>{t("products.main.title")}</ArLabel>} htmlFor="title-ar" hint={enHint(p.title)}>
                    <Input id="title-ar" {...arProps} value={ar.title ?? ""} maxLength={200} placeholder={p.title} onChange={(e) => setAr("title", e.target.value)} />
                  </Field>
                  <Field label={<ArLabel>{t("products.main.tagline")}</ArLabel>} htmlFor="tagline-ar" hint={enHint(p.tagline)}>
                    <Input id="tagline-ar" {...arProps} value={ar.tagline ?? ""} maxLength={300} placeholder={p.tagline} onChange={(e) => setAr("tagline", e.target.value)} />
                  </Field>
                  <div>
                    <p id="description-ar-label" className="mb-1.5 flex items-center gap-2 text-[12.5px] font-medium text-a-dim">
                      <ArLabel>{t("products.main.description")}</ArLabel>
                    </p>
                    <RichTextEditor key="desc-ar" id="description-ar" labelledBy="description-ar-label" dir="rtl" lang="ar" value={ar.description ?? ""} onChange={(html) => setAr("description", html.replace(/<[^>]*>/g, "").trim() ? html : "")} placeholder={t("common.translation.fallbackHint")} />
                  </div>
                </>
              ) : (
                <>
                  <Field label={t("products.main.title")} htmlFor="title" error={show("title")}>
                    <Input
                      id="title"
                      value={p.title}
                      placeholder={t("products.main.titlePh")}
                      onChange={(e) => {
                        const title = e.target.value;
                        setP((x) => ({ ...x, title, handle: handleTouched ? x.handle : slugify(title) }));
                      }}
                    />
                  </Field>
                  <Field label={t("products.main.tagline")} htmlFor="tagline" hint={t("products.main.taglineHint")}>
                    <Input id="tagline" value={p.tagline} maxLength={120} placeholder={t("products.main.taglinePh")} onChange={(e) => set("tagline", e.target.value)} />
                  </Field>
                  <div>
                    <p id="description-label" className="mb-1.5 text-[12.5px] font-medium text-a-dim">
                      {t("products.main.description")}
                    </p>
                    <RichTextEditor key="desc-en" id="description" labelledBy="description-label" value={p.description} onChange={(html) => set("description", html)} placeholder={t("products.main.descriptionPh")} />
                  </div>
                </>
              )}
            </motion.div>
          </Card>

          <AnimatePresence initial={false}>
            {isAr ? (
              <motion.div key="ar-names" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease }}>
                <Card title={<ArLabel>{t("products.arabic.typeAndColours")}</ArLabel>} description={t("products.arabic.typeAndColoursDesc")}>
                  <div className="grid gap-4">
                    <Field label={t("products.arabic.type")} htmlFor="category-ar" hint={enHint(p.category)}>
                      <Input id="category-ar" {...arProps} value={ar.category ?? ""} maxLength={100} placeholder={p.category} onChange={(e) => setAr("category", e.target.value)} />
                    </Field>
                    <Field
                      label={t("products.arabic.colours")}
                      aside={
                        p.colors.some((c) => !ar.colors?.[c.name] && AR_COLOUR_NAMES[c.name]) ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[12px] text-a-accent hover:underline"
                            onClick={() => {
                              const next = { ...ar.colors };
                              for (const c of p.colors) if (!next[c.name] && AR_COLOUR_NAMES[c.name]) next[c.name] = AR_COLOUR_NAMES[c.name];
                              setAr("colors", next);
                            }}
                          >
                            <AIcon name="sparkle" size={12} /> {t("products.lang.suggest")}
                          </button>
                        ) : null
                      }
                    >
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {p.colors.map((c, i) => (
                          <li key={i} className="flex items-center gap-2 rounded-xl bg-a-panel-2/60 p-1.5 ring-1 ring-a-line">
                            <span className="size-6 shrink-0 rounded-full ring-1 ring-a-ink/15" style={{ background: c.hex }} />
                            <span lang="en" dir="ltr" className="w-[88px] shrink-0 truncate text-[12.5px] text-a-dim" title={c.name}>
                              {c.name || "—"}
                            </span>
                            <Input
                              {...arProps}
                              aria-label={t("products.arabic.colourAria", { name: c.name })}
                              value={ar.colors?.[c.name] ?? ""}
                              placeholder={AR_COLOUR_NAMES[c.name] ?? c.name}
                              maxLength={60}
                              disabled={!c.name.trim()}
                              onChange={(e) => {
                                const next = { ...ar.colors };
                                if (e.target.value) next[c.name] = e.target.value;
                                else delete next[c.name];
                                setAr("colors", next);
                              }}
                              className="h-8 min-w-0 flex-1"
                            />
                          </li>
                        ))}
                      </ul>
                    </Field>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Card title={t("products.media.title")} description={t("products.media.description")}>
            <MediaCard colors={p.colors} onChange={(c) => set("colors", c)} />
          </Card>

          <Card title={t("products.pricing.title")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("products.pricing.price")} htmlFor="price" error={show("price")}>
                <Input id="price" type="number" min={0} inputMode="numeric" prefix="EGP" value={p.price || ""} onChange={(e) => set("price", Number(e.target.value) || 0)} />
              </Field>
              <Field label={t("products.pricing.compareAt")} htmlFor="compareAt" error={show("compareAt")} hint={t("products.pricing.compareAtHint")}>
                <Input id="compareAt" type="number" min={0} inputMode="numeric" prefix="EGP" value={p.compareAt ?? ""} onChange={(e) => set("compareAt", optNum(e.target.value))} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 border-t border-a-line pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label={t("products.pricing.cost")} htmlFor="cost" hint={t("products.pricing.costHint")}>
                <Input id="cost" type="number" min={0} inputMode="numeric" prefix="EGP" value={p.cost ?? ""} onChange={(e) => set("cost", optNum(e.target.value))} />
              </Field>
              <Metric label={t("products.pricing.profit")} value={p.cost ? egp(p.price - p.cost) : "—"} tone={p.cost && p.price - p.cost < 0 ? "text-a-danger" : undefined} />
              <Metric label={t("products.pricing.margin")} value={margin === null ? "—" : `${margin.toFixed(1)}%`} tone={margin === null ? "text-a-faint" : margin < 30 ? "text-a-warn" : "text-a-ok"} />
            </div>
            {off ? (
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-a-dim">
                <AIcon name="tag" size={13} className="text-a-pink" /> {t("products.pricing.badge", { pct: `−${off}%` })}
              </p>
            ) : null}
          </Card>

          <Card title={t("products.inventory.title")}>
            <Switch
              checked={tracked}
              onChange={(v) => setP((x) => normalizeVariants({ ...x, trackQuantity: v ? undefined : false }))}
              label={t("products.inventory.track")}
              description={tracked ? t("products.inventory.trackOn") : t("products.inventory.trackOff")}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={t("products.inventory.sku")} htmlFor="sku">
                <Input id="sku" dir="ltr" value={p.sku ?? ""} placeholder="VD-HOOD-400" onChange={(e) => set("sku", e.target.value || undefined)} />
              </Field>
              <Field label={t("products.inventory.barcode")} htmlFor="barcode">
                <Input id="barcode" dir="ltr" value={p.barcode ?? ""} onChange={(e) => set("barcode", e.target.value || undefined)} />
              </Field>
            </div>
          </Card>

          <Card title={t("products.shipping.title")}>
            <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-end">
              <Field label={t("products.shipping.weight")} htmlFor="weight">
                <Input id="weight" type="number" min={0} inputMode="numeric" suffix={fmt.locale === "ar" ? "جم" : "g"} value={p.weight ?? ""} placeholder="450" onChange={(e) => set("weight", optNum(e.target.value))} />
              </Field>
              <p className="pb-2 text-[12px] text-a-faint">{p.weight ? t("products.shipping.perPiece", { kg: (p.weight / 1000).toLocaleString("en", { maximumFractionDigits: 2 }) }) : t("products.shipping.hint")}</p>
            </div>
          </Card>

          <Card
            title={t("products.variants.title")}
            description={t("products.variants.description")}
            actions={<Badge tone="violet">{t("products.variants.count", { count: (p.variants ?? []).length })}</Badge>}
          >
            <VariantsCard p={p} onChange={(next) => setP(() => next)} error={show("colors") ?? show("sizes")} />
          </Card>

          <Card title={isAr ? <ArLabel>{t("products.details.title")}</ArLabel> : t("products.details.title")} description={t("products.details.description")}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              {isAr ? (
                <Field label={t("products.details.material")} htmlFor="material-ar" hint={enHint(p.material)}>
                  <Input id="material-ar" {...arProps} value={ar.material ?? ""} maxLength={200} placeholder={p.material} onChange={(e) => setAr("material", e.target.value)} />
                </Field>
              ) : (
                <Field label={t("products.details.material")} htmlFor="material">
                  <Input id="material" value={p.material} placeholder={t("products.details.materialPh")} onChange={(e) => set("material", e.target.value)} />
                </Field>
              )}
              <Field label={t("products.details.gsm")} htmlFor="gsm">
                <Input id="gsm" type="number" min={0} suffix="GSM" value={p.gsm ?? ""} onChange={(e) => set("gsm", optNum(e.target.value))} />
              </Field>
            </div>
            {isAr ? (
              <>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field label={t("products.details.highlights")} aside={<CopyEnglish show={!ar.highlights?.length && p.highlights.length > 0} onClick={() => setAr("highlights", [...p.highlights])} />} hint={p.highlights.length ? t("common.translation.englishValue", { value: p.highlights.join(" · ") }) : undefined}>
                    <ListEditor label={t("products.details.highlight")} value={ar.highlights ?? []} onChange={(v) => setAr("highlights", v)} placeholder={p.highlights[0]} addLabel={t("products.details.addHighlight")} max={8} inputProps={arProps} />
                  </Field>
                  <Field label={t("products.details.care")} aside={<CopyEnglish show={!ar.care?.length && p.care.length > 0} onClick={() => setAr("care", [...p.care])} />} hint={p.care.length ? t("common.translation.englishValue", { value: p.care.join(" · ") }) : undefined}>
                    <ListEditor label={t("products.details.careLine")} value={ar.care ?? []} onChange={(v) => setAr("care", v)} placeholder={p.care[0]} addLabel={t("products.details.addCare")} max={8} inputProps={arProps} />
                  </Field>
                </div>
                <Field label={t("products.details.modelInfo")} htmlFor="modelInfo-ar" className="mt-5" hint={enHint(p.modelInfo)}>
                  <Input id="modelInfo-ar" {...arProps} value={ar.modelInfo ?? ""} maxLength={500} placeholder={p.modelInfo} onChange={(e) => setAr("modelInfo", e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field label={t("products.details.highlights")}>
                    <ListEditor label={t("products.details.highlight")} value={p.highlights} onChange={(v) => set("highlights", v)} placeholder={t("products.details.highlightPh")} addLabel={t("products.details.addHighlight")} max={8} />
                  </Field>
                  <Field label={t("products.details.care")}>
                    <ListEditor label={t("products.details.careLine")} value={p.care} onChange={(v) => set("care", v)} placeholder={t("products.details.carePh")} addLabel={t("products.details.addCare")} max={8} />
                  </Field>
                </div>
                <Field label={t("products.details.modelInfo")} htmlFor="modelInfo" className="mt-5" hint={t("products.details.modelInfoHint")}>
                  <Input id="modelInfo" value={p.modelInfo ?? ""} onChange={(e) => set("modelInfo", e.target.value || undefined)} />
                </Field>
              </>
            )}
            <div className="mt-5 grid gap-4 border-t border-a-line pt-5 sm:grid-cols-2">
              <Field label={t("products.details.sizeChart")} htmlFor="sizeChart">
                <Select id="sizeChart" value={p.sizeChart} onChange={(e) => set("sizeChart", e.target.value as SizeChartKind)}>
                  {(["tops", "bottoms", "dresses", "onesize"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`products.details.charts.${k}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("products.details.fit")} htmlFor="fit">
                <Select id="fit" value={p.fit} onChange={(e) => set("fit", e.target.value as FitTendency)}>
                  {(["small", "true", "large"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`products.details.fits.${k}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              className="mt-4"
              label={t("products.details.fitSplit")}
              hint={t("products.details.fitSplitHint")}
              error={show("fitSplit") ?? (fitSum !== 100 ? t("products.errors.fitSum", { sum: fitSum }) : undefined)}
              aside={
                fitSum !== 100 ? (
                  <button type="button" className="text-[12px] text-a-accent hover:underline" onClick={() => set("fitSplit", [p.fitSplit[0], Math.max(0, 100 - p.fitSplit[0] - p.fitSplit[2]), p.fitSplit[2]])}>
                    {t("products.details.balance")}
                  </button>
                ) : null
              }
            >
              <div className="grid grid-cols-3 gap-2">
                {(["small", "true", "large"] as const).map((l, i) => (
                  <Input
                    key={l}
                    aria-label={t(`products.details.shares.${l}`)}
                    type="number"
                    min={0}
                    max={100}
                    suffix="%"
                    value={p.fitSplit[i]}
                    onChange={(e) => {
                      const next = [...p.fitSplit] as Product["fitSplit"];
                      next[i] = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                      set("fitSplit", next);
                    }}
                  />
                ))}
              </div>
              <div dir="ltr" className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-a-ink/[0.07] rtl:flex-row-reverse" aria-hidden>
                {p.fitSplit.map((v, i) => (
                  <motion.span key={i} animate={{ width: `${(v / Math.max(fitSum, 100)) * 100}%` }} transition={{ duration: 0.3, ease }} className={["bg-a-blue", "bg-a-ok", "bg-a-pink"][i]} />
                ))}
              </div>
            </Field>
          </Card>

          <Card
            title={isAr ? <ArLabel>{t("products.seo.title")}</ArLabel> : t("products.seo.title")}
            actions={
              <Button type="button" size="xs" variant="ghost" icon={seoOpen ? undefined : "edit"} onClick={() => setSeoOpen((o) => !o)} aria-expanded={seoOpen}>
                {seoOpen ? t("common.done") : t("common.edit")}
              </Button>
            }
          >
            <div dir={isAr ? "rtl" : "ltr"} lang={cl} className="rounded-xl bg-white p-4 text-start text-[#202124] ring-1 ring-black/5">
              <p dir="ltr" className="truncate text-start text-[12px] text-[#4d5156] rtl:text-end">vedra · {isAr ? "/ar" : ""}/products/{p.handle || "…"}</p>
              <p className="mt-1 line-clamp-1 text-[18px] leading-snug text-[#1a0dab]">{seoTitle}</p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#4d5156]">{seoDesc}</p>
            </div>
            {show("handle") && !seoOpen ? <p className="mt-2 text-[12px] text-a-danger">{show("handle")}</p> : null}
            <AnimatePresence initial={false}>
              {seoOpen ? (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease }} className="overflow-hidden">
                  <div className="grid gap-4 pt-5">
                    {isAr ? (
                      <>
                        <Field label={t("products.seo.pageTitle")} htmlFor="seoTitle-ar" aside={<Counter n={(ar.seoTitle ?? "").length} max={70} />} hint={p.seoTitle ? enHint(p.seoTitle) : undefined}>
                          <Input id="seoTitle-ar" {...arProps} value={ar.seoTitle ?? ""} maxLength={200} placeholder={`${ar.title || p.title || t("products.seo.product")} — ${ar.category || p.category || t("products.seo.category")}`} onChange={(e) => setAr("seoTitle", e.target.value)} />
                        </Field>
                        <Field label={t("products.seo.metaDescription")} htmlFor="seoDescription-ar" aside={<Counter n={(ar.seoDescription ?? "").length} max={160} />} hint={p.seoDescription ? enHint(p.seoDescription) : undefined}>
                          <Textarea id="seoDescription-ar" {...arProps} rows={3} maxLength={500} value={ar.seoDescription ?? ""} placeholder={t("products.seo.metaPh")} onChange={(e) => setAr("seoDescription", e.target.value)} />
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label={t("products.seo.pageTitle")} htmlFor="seoTitle" aside={<Counter n={(p.seoTitle ?? "").length} max={70} />}>
                          <Input id="seoTitle" value={p.seoTitle ?? ""} placeholder={`${p.title || t("products.seo.product")} — ${p.category || t("products.seo.category")}`} onChange={(e) => set("seoTitle", e.target.value || undefined)} />
                        </Field>
                        <Field label={t("products.seo.metaDescription")} htmlFor="seoDescription" aside={<Counter n={(p.seoDescription ?? "").length} max={160} />}>
                          <Textarea id="seoDescription" rows={3} value={p.seoDescription ?? ""} placeholder={t("products.seo.metaPh")} onChange={(e) => set("seoDescription", e.target.value || undefined)} />
                        </Field>
                      </>
                    )}
                    <Field
                      label={t("products.seo.handle")}
                      htmlFor="handle"
                      error={show("handle")}
                      hint={<bdi dir="ltr">{`vedra · /products/${p.handle || "…"}`}</bdi>}
                      aside={
                        handleTouched ? (
                          <button
                            type="button"
                            onClick={() => {
                              set("handle", slugify(p.title));
                              setHandleTouched(false);
                            }}
                            className="text-[12px] text-a-accent hover:underline"
                          >
                            {t("products.seo.generate")}
                          </button>
                        ) : (
                          <span className="text-[11.5px] text-a-faint">{t("products.seo.auto")}</span>
                        )
                      }
                    >
                      <Input
                        id="handle"
                        dir="ltr"
                        value={p.handle}
                        onChange={(e) => {
                          setHandleTouched(true);
                          set("handle", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                        }}
                      />
                    </Field>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* ─────────── right column ─────────── */}
        <motion.aside initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06, ease }} className="min-w-0 space-y-5">
          <Card title={t("products.side.status")}>
            <Select aria-label={t("products.side.statusAria")} value={status} onChange={(e) => set("status", e.target.value as ProductStatus)}>
              {(["active", "draft", "archived"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`products.status.${k}`)}
                </option>
              ))}
            </Select>
            <div className="mt-4 border-t border-a-line pt-3.5">
              <p className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint">{t("products.side.publishing")}</p>
              <p className="mt-2 flex items-center gap-2 text-[13px]">
                <span className={cx("size-2 rounded-full", status === "active" ? "bg-a-ok shadow-[0_0_0_3px_rgb(52_211_153/0.18)]" : "bg-a-ink/25")} />
                {t("products.side.onlineStore")}
                <span className="ms-auto text-[12px] text-a-faint">{status === "active" ? t("products.side.visible") : status === "draft" ? t("products.side.hiddenDraft") : t("products.side.hiddenArchived")}</span>
              </p>
            </div>
          </Card>

          <Card
            title={t("products.side.translation")}
            description={t("products.side.translationDesc")}
            actions={<TranslationMeter done={tr.done} total={tr.total} compact />}
          >
            <button type="button" onClick={() => setCl(isAr ? "en" : "ar")} className="fx-press inline-flex h-8 items-center gap-2 rounded-lg bg-a-violet/10 px-3 text-[12.5px] font-medium text-a-accent ring-1 ring-a-violet/25 transition hover:bg-a-violet/15">
              <AIcon name="globe" size={14} />
              {isAr ? t("common.translation.english") : t("common.translation.arabicLabel")}
            </button>
          </Card>

          <Card title={t("products.side.organization")}>
            <OrganizationCard
              p={p}
              set={set}
              manual={d.manual}
              onManual={(manual) => setD((x) => ({ ...x, manual }))}
              categories={options.categories}
              collections={collections}
              allTags={allTags}
              categoryError={show("category")}
            />
          </Card>

          <Card title={t("products.side.cardPreview")} description={t("products.side.cardPreviewDesc")} actions={<Badge tone="violet">{t("products.side.live")}</Badge>}>
            <ProductCardPreview product={p} lang={cl} />
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                {t("products.side.socialProof")} <Badge tone="green">{t("products.side.readOnly")}</Badge>
              </span>
            }
            description={t("products.side.socialDesc")}
          >
            <dl className="grid grid-cols-3 gap-2.5">
              {[
                { label: t("products.side.rating"), value: p.reviewCount ? p.rating.toFixed(1) : "—" },
                { label: t("products.side.reviews"), value: p.reviewCount.toLocaleString("en") },
                { label: t("products.side.sold24h"), value: p.sold24h.toLocaleString("en") },
              ].map((x) => (
                <div key={x.label} className="rounded-xl bg-a-panel-2 px-3 py-2.5 ring-1 ring-a-line">
                  <dt className="text-[11.5px] text-a-faint">{x.label}</dt>
                  <dd className="mt-0.5 text-[17px] font-semibold tabular-nums">{x.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-a-faint">
              <AIcon name="info" size={13} /> {t("products.side.unitsSold")} <span className="tabular-nums text-a-dim">{sold.toLocaleString("en")}</span>
            </p>
          </Card>
        </motion.aside>
      </div>

      <PreviewDrawer open={preview} onClose={() => setPreview(false)} p={p} live={live} lang={cl} />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("products.del.title", { name: product.title || t("products.del.product") })}
        description={t("products.del.description")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" icon="trash" onClick={remove}>
              {t("products.header.deleteProduct")}
            </Button>
          </>
        }
      />

      <SaveBar dirty={dirty || isNew} guard={dirty} saving={saving} onSave={save} onDiscard={isNew ? () => router.push("/admin/products") : discard} label={isNew ? t("products.header.unsavedProduct") : t("common.unsavedChanges")} />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[12.5px] font-medium text-a-dim">{label}</p>
      <p className={cx("flex h-9 items-center text-[15px] font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function ArLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children} <ArChip />
    </span>
  );
}

function CopyEnglish({ show, onClick }: { show: boolean; onClick: () => void }) {
  const { t } = useT();
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} className="text-[12px] text-a-accent hover:underline">
      {t("products.lang.copyEnglish")}
    </button>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <bdi dir="ltr" className={cx("text-[11.5px] tabular-nums", n > max ? "text-a-danger" : n > max * 0.9 ? "text-a-warn" : "text-a-faint")}>
      {n}/{max}
    </bdi>
  );
}

/** "More actions ▾" dropdown. */
function MoreActions({ items }: { items: { label: string; icon: AIconName; onSelect?: () => void; href?: string; danger?: boolean }[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  const cls = (danger?: boolean) => cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] transition", danger ? "text-a-danger hover:bg-a-danger/10" : "text-a-text hover:bg-a-hover");
  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="ghost" iconRight="chevronDown" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="hidden sm:inline">{t("products.header.moreActions")}</span>
        <span className="sm:hidden">{t("products.header.more")}</span>
      </Button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2 }}
            transition={{ duration: 0.16, ease }}
            className="absolute end-0 top-[calc(100%+6px)] z-40 w-[232px] origin-top-right rounded-xl rtl:origin-top-left border border-a-line-strong bg-a-panel-2 p-1 shadow-[0_18px_44px_-16px_var(--a-shadow)]"
          >
            {items.map((it) =>
              it.href ? (
                <a key={it.label} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer" className={cls(it.danger)} onClick={() => setOpen(false)}>
                  <AIcon name={it.icon} size={15} /> {it.label}
                </a>
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  className={cls(it.danger)}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect?.();
                  }}
                >
                  <AIcon name={it.icon} size={15} /> {it.label}
                </button>
              ),
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Storefront-like preview of the draft (works for drafts that aren't live yet). */
function PreviewDrawer({ open, onClose, p, live, lang }: { open: boolean; onClose: () => void; p: Product; live: boolean; lang: AdminLocale }) {
  const { t } = useT();
  const isAr = lang === "ar";
  const html = descriptionHtml(isAr ? p.ar?.description || p.description : p.description);
  const title = isAr ? p.ar?.title || p.title : p.title;
  const range = priceRange(p);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("products.previewDrawer.title")}
      footer={
        live ? (
          <a href={`/products/${p.handle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-a-accent hover:underline">
            {t("products.previewDrawer.openLive")} <AIcon name="external" size={14} className="rtl:-scale-x-100" />
          </a>
        ) : (
          <span className="text-[12.5px] text-a-faint">{t("products.previewDrawer.notLive")}</span>
        )
      }
    >
      <div className="space-y-4">
        <ProductCardPreview product={p} lang={lang} />
        <div dir={isAr ? "rtl" : "ltr"} lang={lang} className="rounded-xl bg-[#fafaf8] p-4 text-start text-[#16181d]">
          <p className="text-[20px] font-semibold leading-tight">{title || t("products.seo.productTitle")}</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums">{range.min !== range.max ? (isAr ? `يبدأ من ${money(range.min)}` : `From ${money(range.min)}`) : money(range.min)}</p>
          {html ? (
            <div
              className="mt-3 space-y-2 text-[14px] leading-relaxed text-[#3b3f46] [&_a]:underline [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ps-5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="mt-3 text-[13px] text-black/40">{t("products.previewDrawer.noDescription")}</p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
