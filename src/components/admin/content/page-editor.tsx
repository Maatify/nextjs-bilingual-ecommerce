"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useState } from "react";
import { deletePage, savePage } from "@/app/admin/(panel)/pages/actions";
import { cx } from "@/lib/format";
import type { AdminLocale } from "@/lib/i18n/admin";
import { pageCompleteness } from "@/lib/i18n/admin/completeness";
import type { ContentPage, ContentPageAr, ContentSection } from "@/lib/types";
import { AIcon } from "../icons";
import { arProps, ContentLangTabs, TranslationMeter, useT } from "../i18n";
import { Badge, Button, ConfirmButton, ease, Field, IconBtn, Input, LinkButton, markOpened, PageHeader, SaveBar, Switch, Textarea, toast, useDraft } from "../ui";
import { Counter, Panel } from "./fields";
import { slugify } from "./pages-list";
import { Sortable } from "./sortable";

export function PageEditor({ saved, site }: { saved: ContentPage; site: { name: string; url: string } }) {
  const router = useRouter();
  const { t, isRtl } = useT();
  const [draft, setDraft, dirty, reset] = useDraft(saved);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<AdminLocale>("en");
  const isAr = lang === "ar";
  const set = (patch: Partial<ContentPage>) => setDraft((d) => ({ ...d, ...patch }));
  const ar: ContentPageAr = draft.ar ?? {};
  const setAr = (patch: Partial<ContentPageAr>) => setDraft((d) => ({ ...d, ar: { ...d.ar, ...patch } }));
  // the field set being edited: English base fields or the Arabic overrides (with English as placeholder)
  const v = isAr ? { title: ar.title ?? "", accent: ar.accent ?? "", intro: ar.intro ?? "", nav: ar.nav ?? "", description: ar.description ?? "", sections: ar.sections ?? [] } : { title: draft.title, accent: draft.accent ?? "", intro: draft.intro, nav: draft.nav, description: draft.description, sections: draft.sections };
  const up = (patch: Partial<typeof v>) => (isAr ? setAr(patch) : set(patch));
  const setSection = (i: number, patch: Partial<ContentSection>) => up({ sections: v.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const fx = isAr ? arProps : {};
  const enPh = (en: string | undefined, fallback?: string) => (isAr ? en || fallback : fallback);
  const meter = pageCompleteness(draft);
  const live = draft.published !== false;

  const save = async () => {
    setSaving(true);
    try {
      const res = await savePage(saved.slug, draft);
      if (!res.ok) return toast.error(t("content.pages.saveFailed"), res.error);
      toast.success(t("content.pages.savedTitle"), live ? t("content.liveOnStore") : t("content.pages.savedHidden"));
      const slug = res.data?.slug ?? saved.slug;
      if (slug !== saved.slug) {
        markOpened(`/admin/pages/${slug}`); // same editor, renamed URL — don't replay the page-open animation
        router.replace(`/admin/pages/${slug}`);
      }
      else router.refresh();
    } catch (e) {
      toast.error(t("content.pages.saveFailed"), e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const res = await deletePage(saved.slug);
    if (!res.ok) return toast.error(t("content.pages.deleteFailed"), res.error);
    toast.success(t("content.pages.deleted"));
    router.push("/admin/pages");
    router.refresh();
  };

  const host = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const metaTitle = `${[v.title || draft.title, v.title ? v.accent : draft.accent].filter(Boolean).join(" ")} · ${site.name}`;
  const pagePath = `${isAr ? "/ar" : ""}/pages/${saved.slug}`;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/pages", label: t("content.pages.title") }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {saved.nav || saved.title}
            {saved.published !== false ? <Badge tone="green" dot>{t("content.pages.published")}</Badge> : <Badge>{t("content.pages.hidden")}</Badge>}
            <TranslationMeter done={meter.done} total={meter.total} />
          </span>
        }
        description={<bdi dir="ltr" className="font-mono text-[12.5px]">/pages/{saved.slug}</bdi>}
        actions={
          <>
            <ContentLangTabs value={lang} onChange={setLang} arDone={meter.done} arTotal={meter.total} />
            <ConfirmButton onConfirm={remove} confirmLabel={t("content.pages.deleteConfirm")} variant="ghost">
              {t("common.delete")}
            </ConfirmButton>
            <LinkButton href={pagePath} external iconRight="external">
              {t("content.pages.viewPage")}
            </LinkButton>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div key={lang} initial={{ opacity: 0, x: isRtl ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease }} className="min-w-0 space-y-5">
          {isAr ? (
            <p className="flex items-start gap-2 rounded-xl border border-a-violet/25 bg-a-violet/[0.06] p-3 text-[12.5px] text-a-dim">
              <AIcon name="info" size={15} className="mt-0.5 shrink-0 text-a-accent" />
              <span>
                <b className="font-semibold text-a-text">{t("content.pages.arabicVersion")}</b> — {t("content.pages.arabicVersionDesc")}
              </span>
            </p>
          ) : null}
          <Panel title={t("content.pages.headingIntro")}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Field label={t("content.pages.pageTitle")} htmlFor="pg-title" hint={isAr && draft.title ? t("content.englishOriginal", { value: draft.title }) : undefined}>
                  <Input id="pg-title" {...fx} value={v.title} onChange={(e) => up({ title: e.target.value })} placeholder={enPh(draft.title, t("content.pages.pageTitlePh"))} />
                </Field>
                <Field label={t("content.pages.accent")} htmlFor="pg-accent" hint={t("content.pages.accentHint")}>
                  <Input id="pg-accent" {...fx} value={v.accent} onChange={(e) => up({ accent: e.target.value })} placeholder={enPh(draft.accent, t("content.pages.accentPh"))} />
                </Field>
              </div>
              <div className="rounded-xl bg-[#ecede8] px-5 py-6 text-[#101310]" aria-hidden dir={isAr ? "rtl" : "ltr"} lang={lang}>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#5f645d]">{t("content.pages.preview")}</p>
                <p className={cx("mt-2 text-[34px] leading-[1] tracking-[-0.02em]", isAr && "leading-[1.3]")}>
                  <span className="font-semibold">{(isAr ? v.title || draft.title : v.title) || t("content.pages.pageTitle")}</span> {(isAr && !v.title ? draft.accent : v.accent) ? <span className="serif-accent">{isAr && !v.title ? draft.accent : v.accent}</span> : null}
                </p>
                {(isAr ? v.intro || draft.intro : v.intro) ? <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-[#3a3f39]">{isAr ? v.intro || draft.intro : v.intro}</p> : null}
              </div>
              <Field label={t("content.pages.intro")} htmlFor="pg-intro" hint={t("content.pages.introHint")}>
                <Textarea id="pg-intro" {...fx} rows={2} value={v.intro} onChange={(e) => up({ intro: e.target.value })} placeholder={enPh(draft.intro)} />
              </Field>
            </div>
          </Panel>

          <Panel
            title={t("content.pages.sectionsTitle")}
            description={t("content.pages.sectionsDesc")}
            actions={
              <>
                {isAr && v.sections.length === 0 && draft.sections.length ? (
                  <Button size="sm" variant="ghost" icon="copy" onClick={() => (setAr({ sections: draft.sections.map((x) => ({ ...x, body: [...x.body], list: x.list ? [...x.list] : undefined })) }), toast.info(t("content.copiedStructure")))}>
                    {t("content.copyFromEnglish")}
                  </Button>
                ) : null}
                <Button size="sm" icon="plus" onClick={() => up({ sections: [...v.sections, { heading: "", body: [""] }] })}>
                  {t("content.pages.addSection")}
                </Button>
              </>
            }
          >
            {v.sections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-a-line-strong px-4 py-8 text-center text-[13px] text-a-dim">{isAr ? t("content.pages.arNoSections") : t("content.pages.noSections")}</p>
            ) : (
              <Sortable
                key={lang}
                items={v.sections}
                onChange={(sections) => up({ sections })}
                label={t("content.pages.section")}
                className="space-y-3"
                render={(s, h) => <SectionCard section={s} index={h.index} handle={h.handle} onRemove={h.remove} onChange={(p) => setSection(h.index, p)} ar={isAr} />}
              />
            )}
          </Panel>
        </motion.div>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-2">
          <Panel title={t("content.pages.visibility")}>
            <Switch checked={live} onChange={(on) => set({ published: on })} label={live ? t("content.pages.published") : t("content.pages.hidden")} description={live ? t("content.pages.visibleDesc") : t("content.pages.hiddenDesc")} />
          </Panel>

          <Panel title={t("content.pages.urlNav")}>
            <div className="space-y-4">
              <Field label={t("content.pages.navLabel")} htmlFor="pg-nav" hint={t("content.pages.navLabelHint")}>
                <Input id="pg-nav" {...fx} value={v.nav} onChange={(e) => up({ nav: e.target.value })} placeholder={enPh(draft.nav)} />
              </Field>
              <Field label={t("content.pages.handle")} htmlFor="pg-slug" hint={draft.slug !== saved.slug ? t("content.pages.handleHint") : undefined}>
                <div dir="ltr">
                  <Input id="pg-slug" prefix="/pages/" className="[&_input]:pl-[62px] [&_input]:font-mono [&_input]:text-[12.5px]" value={draft.slug} onChange={(e) => set({ slug: slugify(e.target.value.replace(/\s/g, "-")) + (e.target.value.endsWith("-") ? "-" : "") })} />
                </div>
              </Field>
            </div>
          </Panel>

          <Panel title={t("content.pages.seo")}>
            <Field label={t("content.pages.metaDesc")} htmlFor="pg-desc" aside={<Counter value={v.description} max={160} ideal={[110, 160]} />} hint={t("content.pages.metaDescHint")}>
              <Textarea id="pg-desc" {...fx} rows={3} value={v.description} onChange={(e) => up({ description: e.target.value })} placeholder={enPh(draft.description)} />
            </Field>
            <div className="mt-4 rounded-xl bg-white p-3.5 font-[arial,sans-serif]" aria-label={t("content.pages.googlePreview")} dir={isAr ? "rtl" : "ltr"}>
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-[#f1f3f4] text-[10px] font-bold text-[#101310]">{site.name.slice(0, 1)}</span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[12px] text-[#202124]">{site.name}</span>
                  <bdi dir="ltr" className="block truncate text-start text-[11px] text-[#4d5156]">
                    {host} › {isAr ? "ar › " : ""}pages › {draft.slug || "…"}
                  </bdi>
                </span>
              </div>
              <p className="mt-1.5 truncate text-[16px] leading-snug text-[#1a0dab]">{metaTitle}</p>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[#4d5156]">{(isAr ? v.description || v.intro || draft.description || draft.intro : draft.description || draft.intro) || t("content.pages.metaPh")}</p>
            </div>
          </Panel>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onDiscard={reset} onSave={save} />
    </>
  );
}

function SectionCard({ section, index, handle, onRemove, onChange, ar }: { section: ContentSection; index: number; handle: React.ReactNode; onRemove: () => void; onChange: (p: Partial<ContentSection>) => void; ar?: boolean }) {
  const { t } = useT();
  const fx = ar ? arProps : {};
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-a-line bg-a-panel-2/50">
      <div className="flex items-center gap-1.5 p-2">
        {handle}
        <span className="w-6 text-center text-[11.5px] tabular-nums text-a-faint">{index + 1}</span>
        <Input aria-label={t("content.pages.sectionHeading", { n: index + 1 })} {...fx} value={section.heading} onChange={(e) => onChange({ heading: e.target.value })} placeholder={t("content.pages.sectionHeadingPh")} className="flex-1 font-medium" />
        <IconBtn icon="chevronDown" label={open ? t("content.pages.collapse") : t("content.pages.expand")} onClick={() => setOpen((o) => !o)} className={cx("transition-transform", !open && "-rotate-90 rtl:rotate-90")} aria-expanded={open} />
        <IconBtn icon="trash" label={t("content.pages.deleteSection", { n: index + 1 })} onClick={onRemove} className="hover:text-a-danger" />
      </div>
      <motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
        <div className="space-y-4 px-3 pb-3.5 ps-3 sm:ps-[72px]">
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-a-dim">{t("content.pages.paragraphs")}</p>
            <Sortable
              items={section.body}
              onChange={(body) => onChange({ body })}
              label={t("content.pages.paragraph")}
              className="space-y-1.5"
              render={(p, h) => (
                <div className="flex items-start gap-1">
                  <span className="pt-1.5">{h.handle}</span>
                  <Textarea aria-label={t("content.pages.paragraphN", { n: h.index + 1 })} {...fx} rows={2} value={p} onChange={(e) => onChange({ body: section.body.map((x, i) => (i === h.index ? e.target.value : x)) })} className="min-h-[60px] flex-1" />
                  <IconBtn icon="close" label={t("content.pages.removeParagraph", { n: h.index + 1 })} onClick={h.remove} className="mt-1" />
                </div>
              )}
            />
            <Button size="xs" variant="ghost" icon="plus" className="mt-1.5" onClick={() => onChange({ body: [...section.body, ""] })}>
              {t("content.pages.addParagraph")}
            </Button>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[12px] font-medium text-a-dim">{t("content.pages.bulletList")}</p>
              {section.list ? (
                <button type="button" onClick={() => onChange({ list: undefined })} className="text-[12px] text-a-faint transition hover:text-a-danger">
                  {t("content.pages.removeList")}
                </button>
              ) : null}
            </div>
            {section.list ? (
              <>
                <Sortable
                  items={section.list}
                  onChange={(list) => onChange({ list })}
                  label={t("content.pages.bullet")}
                  className="space-y-1.5"
                  render={(b, h) => (
                    <div className="flex items-center gap-1">
                      {h.handle}
                      <AIcon name="check" size={13} className="shrink-0 text-a-faint" />
                      <Input aria-label={t("content.pages.bulletN", { n: h.index + 1 })} {...fx} value={b} onChange={(e) => onChange({ list: section.list!.map((x, i) => (i === h.index ? e.target.value : x)) })} className="flex-1" />
                      <IconBtn icon="close" label={t("content.pages.removeBullet", { n: h.index + 1 })} onClick={h.remove} />
                    </div>
                  )}
                />
                <Button size="xs" variant="ghost" icon="plus" className="mt-1.5" onClick={() => onChange({ list: [...(section.list ?? []), ""] })}>
                  {t("content.pages.addBullet")}
                </Button>
              </>
            ) : (
              <Button size="xs" variant="outline" icon="plus" onClick={() => onChange({ list: [""] })}>
                {t("content.pages.addBulletList")}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
