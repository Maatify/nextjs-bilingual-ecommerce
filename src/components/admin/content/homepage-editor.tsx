"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { saveHomepage, type HomeAr } from "@/app/admin/(panel)/homepage/actions";
import { cx } from "@/lib/format";
import type { AdminLocale } from "@/lib/i18n/admin";
import { countPairs } from "@/lib/i18n/admin/completeness";
import type { HomeContent, HomeSectionId, NavLink, StoreContent } from "@/lib/types";
import { AIcon, type AIconName } from "../icons";
import { arProps, ContentLangTabs, TranslationMeter, useT } from "../i18n";
import { Badge, Card, ease, Field, Input, LinkButton, PageHeader, SaveBar, Switch, Textarea, useDraft } from "../ui";
import { Counter, ImageList, Panel, ProductSelect, TagList } from "./fields";
import { LinkInput } from "./link-picker";
import { HeroPreview, RibbonsPreview } from "./previews";
import { Sortable } from "./sortable";
import type { LinkTarget, ProductOption } from "./types";
import { useSaver } from "./use-saver";

type Draft = { home: HomeContent; ribbons: StoreContent["ribbons"]; ar: HomeAr };

const ICONS: Record<HomeSectionId, AIconName> = { hero: "home", ribbons: "sparkle", categories: "collections", edit: "products", "matching-set": "layers", "colour-story": "palette", reviews: "reviews", trust: "lock", faq: "faq" };
type TitleKey = "editTitle" | "setTitle" | "colourStoryTitle";

/** Arabic homepage completeness: hero copy, section titles and ribbon tapes. */
export function homeCompleteness(d: Draft) {
  const h = d.home.hero;
  const a = d.ar.hero ?? {};
  return countPairs([
    [h.eyebrow, a.eyebrow],
    [h.title, a.title],
    [h.subtitle, a.subtitle],
    [h.primary.label, a.primaryLabel],
    [h.secondary.label, a.secondaryLabel],
    [d.home.editTitle, d.ar.editTitle],
    [d.home.setTitle, d.ar.setTitle],
    [d.home.colourStoryTitle, d.ar.colourStoryTitle],
    [d.ribbons.a, d.ar.ribbons?.a],
    [d.ribbons.b, d.ar.ribbons?.b],
  ]);
}

export function HomepageEditor({ saved, targets, products }: { saved: Draft; targets: LinkTarget[]; products: ProductOption[] }) {
  const { t, isRtl } = useT();
  const [draft, setDraft, dirty, reset] = useDraft(saved);
  const [selected, setSelected] = useState<HomeSectionId>("hero");
  const [lang, setLang] = useState<AdminLocale>("en");
  const [save, saving] = useSaver(saveHomepage, t("content.home.saved"));
  const label = (id: HomeSectionId) => t(`content.home.meta.${id}.label`);
  const caption = (id: HomeSectionId) => t(`content.home.meta.${id}.caption`);
  const meter = homeCompleteness(draft);
  const setAr = (patch: Partial<HomeAr>) => setDraft((d) => ({ ...d, ar: { ...d.ar, ...patch } }));
  const heroAr = draft.ar.hero ?? {};
  // hero as Arabic visitors see it (per-field fallback to English)
  const previewHero: HomeContent["hero"] =
    lang === "ar"
      ? {
          ...draft.home.hero,
          eyebrow: heroAr.eyebrow || draft.home.hero.eyebrow,
          title: heroAr.title || draft.home.hero.title,
          subtitle: heroAr.subtitle || draft.home.hero.subtitle,
          primary: { ...draft.home.hero.primary, label: heroAr.primaryLabel || draft.home.hero.primary.label },
          secondary: { ...draft.home.hero.secondary, label: heroAr.secondaryLabel || draft.home.hero.secondary.label },
        }
      : draft.home.hero;

  const home = draft.home;
  const setHome = (patch: Partial<HomeContent>) => setDraft((d) => ({ ...d, home: { ...d.home, ...patch } }));
  const setHero = (patch: Partial<HomeContent["hero"]>) => setDraft((d) => ({ ...d, home: { ...d.home, hero: { ...d.home.hero, ...patch } } }));
  const toggle = (id: HomeSectionId, enabled: boolean) => setHome({ sections: home.sections.map((s) => (s.id === id ? { ...s, enabled } : s)) });
  const section = home.sections.find((s) => s.id === selected);
  const enabledCount = home.sections.filter((s) => s.enabled).length;

  return (
    <>
      <PageHeader
        title={t("content.home.title")}
        description={t("content.home.description")}
        actions={
          <>
            <TranslationMeter done={meter.done} total={meter.total} />
            <ContentLangTabs value={lang} onChange={setLang} arDone={meter.done} arTotal={meter.total} />
            <LinkButton href={lang === "ar" ? "/ar" : "/"} external variant="secondary" iconRight="external">
              {t("content.previewStore")}
            </LinkButton>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        {/* Sections */}
        <Card padded={false} className="lg:row-span-2 xl:row-span-1" title={t("content.home.sections")} description={t("content.home.sectionsDesc", { visible: enabledCount, total: home.sections.length })}>
          <Sortable
            items={home.sections}
            onChange={(sections) => setHome({ sections })}
            label={t("content.home.section")}
            className="flex flex-col gap-0.5 p-2"
            render={(s, h) => {
              const active = s.id === selected;
              return (
                <div className={cx("group relative flex items-center gap-1.5 rounded-xl py-1 ps-1 pe-2 transition-colors", active ? "" : "hover:bg-a-ink/[0.03]")}>
                  {active ? <motion.span layoutId="home-sec-active" className="absolute inset-0 rounded-xl bg-a-ink/[0.06] ring-1 ring-inset ring-a-ink/[0.07]" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
                  <span className="relative">{h.handle}</span>
                  <button type="button" onClick={() => setSelected(s.id)} aria-current={active || undefined} className="relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-a-violet/60">
                    <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg border transition-colors", active ? "border-a-violet/40 bg-a-violet/15 text-a-accent" : "border-a-line bg-a-panel-2 text-a-dim")}>
                      <AIcon name={ICONS[s.id]} size={15} />
                    </span>
                    <span className={cx("min-w-0 transition-opacity", !s.enabled && "opacity-45")}>
                      <span className="block truncate text-[13px] font-medium">{label(s.id)}</span>
                      <span className="block truncate text-[11.5px] text-a-faint">{caption(s.id)}</span>
                    </span>
                  </button>
                  <span className="relative">
                    <Switch checked={s.enabled} onChange={(v) => toggle(s.id, v)} />
                  </span>
                </div>
              );
            }}
          />
        </Card>

        {/* Editor panel */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${selected}-${lang}`} initial={{ opacity: 0, x: isRtl ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRtl ? 8 : -8 }} transition={{ duration: 0.2, ease }}>
              <Panel
                title={
                  <span className="flex items-center gap-2">
                    {label(selected)}
                    {section && !section.enabled ? <Badge>{t("common.hidden")}</Badge> : <Badge tone="green" dot>{t("common.visible")}</Badge>}
                    {lang === "ar" ? <Badge tone="violet">العربية</Badge> : null}
                  </span>
                }
                description={caption(selected)}
                actions={section ? <Switch checked={section.enabled} onChange={(v) => toggle(selected, v)} /> : null}
              >
                {lang === "ar" ? <ArabicPanel id={selected} draft={draft} setAr={setAr} /> : <SectionPanel id={selected} draft={draft} setHero={setHero} setHome={setHome} setRibbons={(ribbons) => setDraft((d) => ({ ...d, ribbons }))} targets={targets} products={products} />}
              </Panel>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Live preview */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-2 xl:sticky xl:top-2 xl:col-start-3 xl:row-start-1">
          <Card
            title={t("content.home.livePreview")}
            description={t("content.home.livePreviewDesc")}
            actions={
              <a href={lang === "ar" ? "/ar" : "/"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-a-dim transition hover:text-a-text">
                {t("content.home.open")} <AIcon name="external" size={13} className="rtl:-scale-x-100" />
              </a>
            }
          >
            <div className={cx("transition-opacity", !home.sections.find((s) => s.id === "hero")?.enabled && "opacity-40")}>
              <HeroPreview hero={previewHero} lang={lang === "ar" ? "ar" : undefined} featured={products.find((p) => p.id === home.hero.featuredProductId)} />
            </div>
            <ol className="mt-4 space-y-1" aria-label={t("content.home.sectionOrder")}>
              {home.sections.map((s, i) => (
                <motion.li layout key={s.id} transition={{ duration: 0.25, ease }} className={cx("flex items-center gap-2 text-[12px]", s.enabled ? "text-a-dim" : "text-a-faint line-through")}>
                  <span className="w-4 text-end tabular-nums text-a-faint">{i + 1}</span>
                  <span className={cx("h-1.5 rounded-full", s.enabled ? "a-grad" : "bg-a-ink/10")} style={{ width: s.id === "hero" ? 40 : 24 }} />
                  {label(s.id)}
                </motion.li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onDiscard={reset} onSave={() => save(draft)} />
    </>
  );
}

function SectionPanel({
  id,
  draft,
  setHero,
  setHome,
  setRibbons,
  targets,
  products,
}: {
  id: HomeSectionId;
  draft: Draft;
  setHero: (p: Partial<HomeContent["hero"]>) => void;
  setHome: (p: Partial<HomeContent>) => void;
  setRibbons: (r: StoreContent["ribbons"]) => void;
  targets: LinkTarget[];
  products: ProductOption[];
}) {
  const { t } = useT();
  const { home, ribbons } = draft;
  const hero = home.hero;

  if (id === "hero")
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("content.home.eyebrow")} htmlFor="h-eyebrow" hint={t("content.home.eyebrowHint")} aside={<Counter value={hero.eyebrow} max={40} />}>
            <Input id="h-eyebrow" value={hero.eyebrow} onChange={(e) => setHero({ eyebrow: e.target.value })} placeholder={t("content.home.eyebrowPh")} />
          </Field>
          <Field label={t("content.home.subtitle")} htmlFor="h-sub" aside={<Counter value={hero.subtitle} max={90} />}>
            <Input id="h-sub" value={hero.subtitle} onChange={(e) => setHero({ subtitle: e.target.value })} placeholder={t("content.home.subtitlePh")} />
          </Field>
        </div>
        <Field label={t("content.home.heroTitle")} htmlFor="h-title" hint={t("content.home.heroTitleHint")} aside={<Counter value={hero.title} max={40} ideal={[8, 28]} />}>
          <Textarea id="h-title" rows={2} value={hero.title} onChange={(e) => setHero({ title: e.target.value })} className="min-h-[64px] font-medium" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <CtaFields label={t("content.home.primaryBtn")} value={hero.primary} onChange={(primary) => setHero({ primary })} targets={targets} />
          <CtaFields label={t("content.home.secondaryBtn")} value={hero.secondary} onChange={(secondary) => setHero({ secondary })} targets={targets} />
        </div>
        <div className="rounded-xl border border-a-line bg-a-panel-2/60 p-3.5">
          <Switch
            checked={hero.autoBestsellers !== false}
            onChange={(v) => setHero({ autoBestsellers: v })}
            label={t("content.home.autoBest")}
            description={t("content.home.autoBestDesc")}
          />
        </div>
        <Field
          label={t("content.home.heroImages")}
          hint={hero.autoBestsellers !== false ? t("content.home.heroImagesAuto") : t("content.home.heroImagesManual")}
        >
          <ImageList value={hero.images} onChange={(images) => setHero({ images })} max={6} />
        </Field>
        <Field label={t("content.home.featured")} hint={t("content.home.featuredHint")}>
          <ProductSelect value={hero.featuredProductId} onChange={(featuredProductId) => setHero({ featuredProductId })} products={products} allowNone />
        </Field>
      </div>
    );

  if (id === "ribbons")
    return (
      <div className="space-y-5">
        <RibbonsPreview a={ribbons.a} b={ribbons.b} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#101310] ring-1 ring-a-ink/20" />{t("content.home.frontTape")}</span>}>
            <TagList value={ribbons.a} onChange={(a) => setRibbons({ ...ribbons, a })} label={t("content.home.frontPhrase")} />
          </Field>
          <Field label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-[#a8b699]" />{t("content.home.backTape")}</span>}>
            <TagList value={ribbons.b} onChange={(b) => setRibbons({ ...ribbons, b })} label={t("content.home.backPhrase")} />
          </Field>
        </div>
        <p className="text-[12px] text-a-faint">{t("content.home.ribbonsTip")}</p>
      </div>
    );

  if (id === "edit" || id === "matching-set" || id === "colour-story") {
    const key: TitleKey = id === "edit" ? "editTitle" : id === "matching-set" ? "setTitle" : "colourStoryTitle";
    const source = id === "edit" ? { href: "/admin/products", label: t("content.home.src.products"), note: t("content.home.notes.edit") } : id === "matching-set" ? { href: "/admin/categories", label: t("content.home.src.categories"), note: t("content.home.notes.set") } : { href: "/admin/products", label: t("content.home.src.products"), note: t("content.home.notes.colour") };
    return (
      <div className="space-y-5">
        <Field label={t("content.home.sectionTitle")} htmlFor="sec-title" aside={<Counter value={home[key]} max={40} />}>
          <Input id="sec-title" value={home[key]} onChange={(e) => setHome({ [key]: e.target.value } as Partial<HomeContent>)} />
        </Field>
        <div className="rounded-xl border border-a-line bg-[#ecede8] p-5 text-[#101310]">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#5f645d]">{t("content.home.preview")}</p>
          <p className="mt-2 font-poster text-[30px] leading-[0.95]" dir="auto">
            {home[key] || t("common.untitled")}
          </p>
        </div>
        <SourceNote {...source} />
      </div>
    );
  }

  return <SourceNote {...sourceInfo(id, t)} />;
}

function sourceInfo(id: HomeSectionId, t: ReturnType<typeof useT>["t"]): { href: string; label: string; note: string } {
  if (id === "reviews") return { href: "/admin/reviews", label: t("content.home.src.reviews"), note: t("content.home.notes.reviews") };
  if (id === "trust") return { href: "/admin/discounts", label: t("content.home.src.discounts"), note: t("content.home.notes.trust") };
  if (id === "faq") return { href: "/admin/faq", label: t("content.home.src.faq"), note: t("content.home.notes.faq") };
  return { href: "/admin/categories", label: t("content.home.src.categories"), note: t("content.home.notes.categories") };
}

/** Arabic copy for the selected section — text only; links, photos and products are shared with English. */
function ArabicPanel({ id, draft, setAr }: { id: HomeSectionId; draft: Draft; setAr: (p: Partial<HomeAr>) => void }) {
  const { t } = useT();
  const { home, ribbons, ar } = draft;
  const hero = home.hero;
  const h = ar.hero ?? {};
  const setH = (patch: NonNullable<HomeAr["hero"]>) => setAr({ hero: { ...h, ...patch } });
  const shared = (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-a-line-strong bg-a-panel-2/50 p-3 text-[12.5px] text-a-dim">
      <AIcon name="info" size={15} className="mt-0.5 shrink-0 text-a-accent" />
      {t("content.arabicSharedNote")}
    </p>
  );
  const en = (v: string) => (v ? t("content.englishOriginal", { value: v }) : t("common.translation.fallbackHint"));

  if (id === "hero")
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("content.home.eyebrow")} htmlFor="ha-eyebrow" hint={en(hero.eyebrow)} aside={<Counter value={h.eyebrow ?? ""} max={40} />}>
            <Input id="ha-eyebrow" {...arProps} value={h.eyebrow ?? ""} onChange={(e) => setH({ eyebrow: e.target.value })} placeholder={hero.eyebrow} />
          </Field>
          <Field label={t("content.home.subtitle")} htmlFor="ha-sub" hint={en(hero.subtitle)} aside={<Counter value={h.subtitle ?? ""} max={90} />}>
            <Input id="ha-sub" {...arProps} value={h.subtitle ?? ""} onChange={(e) => setH({ subtitle: e.target.value })} placeholder={hero.subtitle} />
          </Field>
        </div>
        <Field label={t("content.home.heroTitle")} htmlFor="ha-title" hint={t("content.home.heroTitleHint")} aside={<Counter value={h.title ?? ""} max={40} ideal={[8, 28]} />}>
          <Textarea id="ha-title" {...arProps} rows={2} value={h.title ?? ""} onChange={(e) => setH({ title: e.target.value })} placeholder={hero.title} className="min-h-[64px] font-medium" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("content.home.btnLabel", { label: t("content.home.primaryBtn") })} htmlFor="ha-p" hint={en(hero.primary.label)}>
            <Input id="ha-p" {...arProps} value={h.primaryLabel ?? ""} onChange={(e) => setH({ primaryLabel: e.target.value })} placeholder={hero.primary.label} />
          </Field>
          <Field label={t("content.home.btnLabel", { label: t("content.home.secondaryBtn") })} htmlFor="ha-s" hint={en(hero.secondary.label)}>
            <Input id="ha-s" {...arProps} value={h.secondaryLabel ?? ""} onChange={(e) => setH({ secondaryLabel: e.target.value })} placeholder={hero.secondary.label} />
          </Field>
        </div>
        {shared}
      </div>
    );

  if (id === "ribbons") {
    const ra = ar.ribbons?.a ?? [];
    const rb = ar.ribbons?.b ?? [];
    return (
      <div className="space-y-5">
        <RibbonsPreview a={ra.length ? ra : ribbons.a} b={rb.length ? rb : ribbons.b} lang="ar" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("content.home.frontTape")} hint={en(ribbons.a.join(" · "))}>
            <TagList lang="ar" value={ra} onChange={(a) => setAr({ ribbons: { a, b: rb } })} label={t("content.home.frontPhrase")} />
          </Field>
          <Field label={t("content.home.backTape")} hint={en(ribbons.b.join(" · "))}>
            <TagList lang="ar" value={rb} onChange={(b) => setAr({ ribbons: { a: ra, b } })} label={t("content.home.backPhrase")} />
          </Field>
        </div>
        <p className="text-[12px] text-a-faint">{t("content.home.ribbonsTip")}</p>
      </div>
    );
  }

  if (id === "edit" || id === "matching-set" || id === "colour-story") {
    const key: TitleKey = id === "edit" ? "editTitle" : id === "matching-set" ? "setTitle" : "colourStoryTitle";
    return (
      <div className="space-y-5">
        <Field label={t("content.home.sectionTitle")} htmlFor="sec-title-ar" hint={en(home[key])} aside={<Counter value={ar[key] ?? ""} max={40} />}>
          <Input id="sec-title-ar" {...arProps} value={ar[key] ?? ""} onChange={(e) => setAr({ [key]: e.target.value })} placeholder={home[key]} />
        </Field>
        <div className="rounded-xl border border-a-line bg-[#ecede8] p-5 text-[#101310]" dir="rtl" lang="ar">
          <p className="text-[10.5px] font-medium text-[#5f645d]">{t("content.home.preview")}</p>
          <p className="mt-2 text-[28px] font-bold leading-[1.2]">{ar[key] || home[key] || t("common.untitled")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-a-dim">{t("content.home.noArabicFields")}</p>
      <SourceNote {...sourceInfo(id, t)} />
    </div>
  );
}

function SourceNote({ href, label, note }: { href: string; label: string; note: string }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-a-line-strong bg-a-panel-2/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2.5 text-[13px] text-a-dim">
        <AIcon name="info" size={16} className="mt-0.5 shrink-0 text-a-accent" />
        {note}
      </p>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-a-accent transition hover:text-a-text">
        {t("content.home.manageIn", { label })} <AIcon name="chevronRight" size={14} className="rtl:-scale-x-100" />
      </Link>
    </div>
  );
}

function CtaFields({ label, value, onChange, targets }: { label: string; value: NavLink; onChange: (v: NavLink) => void; targets: LinkTarget[] }) {
  const { t } = useT();
  return (
    <fieldset className="rounded-xl border border-a-line bg-a-panel-2/40 p-3.5">
      <legend className="px-1 text-[12.5px] font-medium text-a-dim">{label}</legend>
      <div className="space-y-2.5">
        <Input aria-label={t("content.home.btnLabel", { label })} value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} placeholder={t("content.home.btnLabelPh")} />
        <LinkInput ariaLabel={t("content.home.btnLink", { label })} value={value.href} targets={targets} onChange={(href, l) => onChange({ label: value.label || l || "", href })} />
      </div>
    </fieldset>
  );
}
