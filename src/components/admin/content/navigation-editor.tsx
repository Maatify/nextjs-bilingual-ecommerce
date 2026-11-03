"use client";

import { useState } from "react";
import { saveNavigation, type NavigationInput, type NavLinkInput } from "@/app/admin/(panel)/navigation/actions";
import type { AdminLocale } from "@/lib/i18n/admin";
import { countPairs } from "@/lib/i18n/admin/completeness";
import { arProps, ContentLangTabs, TranslationMeter, useT } from "../i18n";
import { Badge, Button, Card, EmptyState, IconBtn, Input, LinkButton, PageHeader, SaveBar, useDraft } from "../ui";
import { Panel } from "./fields";
import { LinkInput } from "./link-picker";
import { AnnouncementPreview } from "./previews";
import { Sortable } from "./sortable";
import type { LinkTarget } from "./types";
import { useSaver } from "./use-saver";

type Draft = NavigationInput;

export function navCompleteness(d: Draft) {
  const links = [...d.nav, ...d.announcement, ...d.footer.flatMap((c) => c.links)];
  return countPairs([...links.map((l): [unknown, unknown] => [l.label, l.ar]), ...d.footer.map((c): [unknown, unknown] => [c.title, c.ar])]);
}

export function NavigationEditor({ saved, targets }: { saved: Draft; targets: LinkTarget[] }) {
  const { t } = useT();
  const [draft, setDraft, dirty, reset] = useDraft(saved);
  const [lang, setLang] = useState<AdminLocale>("en");
  const [save, saving] = useSaver(saveNavigation, t("content.nav.saved"));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const ar = lang === "ar";
  const meter = navCompleteness(draft);
  const arLinks = (l: NavLinkInput[]) => l.map((x) => ({ label: x.ar || x.label, href: x.href }));

  return (
    <>
      <PageHeader
        title={t("content.nav.title")}
        description={t("content.nav.description")}
        actions={
          <>
            <TranslationMeter done={meter.done} total={meter.total} />
            <ContentLangTabs value={lang} onChange={setLang} arDone={meter.done} arTotal={meter.total} />
            <LinkButton href={ar ? "/ar" : "/"} external iconRight="external">
              {t("content.previewStore")}
            </LinkButton>
          </>
        }
      />

      <Card title={t("content.nav.livePreview")} description={t("content.nav.livePreviewDesc")} className="mb-5">
        <AnnouncementPreview items={ar ? arLinks(draft.announcement) : draft.announcement} nav={ar ? arLinks(draft.nav) : draft.nav} lang={ar ? "ar" : undefined} />
      </Card>

      {ar ? <p className="mb-4 text-[12.5px] text-a-dim">{t("content.nav.arDesc")}</p> : null}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel
          title={t("content.nav.header")}
          description={ar ? undefined : t("content.nav.headerDesc")}
          actions={
            ar ? null : (
              <Button size="sm" icon="plus" onClick={() => set("nav", [...draft.nav, { label: "", href: "" }])}>
                {t("content.nav.addLink")}
              </Button>
            )
          }
        >
          <LinkRows items={draft.nav} onChange={(v) => set("nav", v)} targets={targets} label={t("content.nav.menuLink")} empty={t("content.nav.headerEmpty")} ar={ar} />
        </Panel>

        <Panel
          title={t("content.nav.announcement")}
          description={ar ? undefined : t("content.nav.announcementDesc")}
          actions={
            ar ? null : (
              <Button size="sm" icon="plus" onClick={() => set("announcement", [...draft.announcement, { label: "", href: "" }])}>
                {t("content.nav.addMessage")}
              </Button>
            )
          }
        >
          <LinkRows items={draft.announcement} onChange={(v) => set("announcement", v)} targets={targets} label={t("content.nav.message")} placeholder={t("content.nav.messagePh")} optionalLink empty={t("content.nav.announcementEmpty")} ar={ar} />
        </Panel>
      </div>

      <Panel
        className="mt-5"
        title={t("content.nav.footer")}
        description={ar ? undefined : t("content.nav.footerDesc")}
        actions={
          ar ? null : (
            <Button size="sm" icon="plus" onClick={() => set("footer", [...draft.footer, { title: "", links: [{ label: "", href: "" }] }])} disabled={draft.footer.length >= 5}>
              {t("content.nav.addColumn")}
            </Button>
          )
        }
      >
        {draft.footer.length === 0 ? (
          <EmptyState icon="nav" title={t("content.nav.noColumns")} description={t("content.nav.noColumnsDesc")} />
        ) : (
          <Sortable
            items={draft.footer}
            onChange={(v) => set("footer", v)}
            label={t("content.nav.column")}
            disabled={ar}
            className="grid gap-3"
            render={(col, h) => {
              const update = (patch: Partial<typeof col>) => set("footer", draft.footer.map((c, i) => (i === h.index ? { ...c, ...patch } : c)));
              return (
                <div className="rounded-xl border border-a-line bg-a-panel-2/50 p-3">
                  <div className="flex items-center gap-2">
                    {h.handle}
                    {ar ? (
                      <Input aria-label={t("content.nav.columnTitle", { n: h.index + 1 })} {...arProps} value={col.ar ?? ""} onChange={(e) => update({ ar: e.target.value })} placeholder={col.title} title={t("content.englishOriginal", { value: col.title })} className="max-w-[260px] font-medium" />
                    ) : (
                      <Input aria-label={t("content.nav.columnTitle", { n: h.index + 1 })} value={col.title} onChange={(e) => update({ title: e.target.value })} placeholder={t("content.nav.columnTitlePh")} className="max-w-[260px] font-medium" />
                    )}
                    <span className="ms-auto text-[12px] text-a-faint">{t("content.nav.links", { count: col.links.length })}</span>
                    {ar ? null : <IconBtn icon="trash" label={t("content.nav.deleteColumn", { name: col.title || h.index + 1 })} onClick={h.remove} />}
                  </div>
                  <div className="mt-3 ps-1 sm:ps-9">
                    <LinkRows items={col.links} onChange={(links) => update({ links })} targets={targets} label={t("content.nav.columnLink", { name: col.title || t("content.nav.column") })} empty={t("content.nav.noLinks")} compact ar={ar} />
                    {ar ? null : (
                      <Button size="xs" variant="ghost" icon="plus" className="mt-2" onClick={() => update({ links: [...col.links, { label: "", href: "" }] })}>
                        {t("content.nav.addLink")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </Panel>

      <SaveBar dirty={dirty} saving={saving} onDiscard={reset} onSave={() => save(draft)} />
    </>
  );
}

function LinkRows({ items, onChange, targets, label, empty, placeholder, optionalLink, compact, ar }: { items: NavLinkInput[]; onChange: (v: NavLinkInput[]) => void; targets: LinkTarget[]; label: string; empty: string; placeholder?: string; optionalLink?: boolean; compact?: boolean; ar?: boolean }) {
  const { t } = useT();
  if (!items.length) return <p className="rounded-xl border border-dashed border-a-line-strong px-4 py-6 text-center text-[12.5px] text-a-dim">{empty}</p>;
  return (
    <Sortable
      items={items}
      onChange={onChange}
      label={label}
      disabled={ar}
      className={compact ? "space-y-1.5" : "space-y-2"}
      render={(l, h) => {
        const update = (patch: Partial<NavLinkInput>) => onChange(items.map((x, i) => (i === h.index ? { ...x, ...patch } : x)));
        if (ar)
          return (
            <div className="grid items-center gap-1.5 rounded-xl bg-a-panel sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Input aria-label={t("content.nav.text", { label, n: h.index + 1 })} {...arProps} value={l.ar ?? ""} onChange={(e) => update({ ar: e.target.value })} placeholder={l.label || placeholder} />
              <span className="flex min-w-0 items-center gap-2 px-1 text-[12px] text-a-faint">
                <Badge className="max-w-[45%] truncate">{l.label || "—"}</Badge>
                <bdi dir="ltr" className="truncate font-mono">
                  {l.href || "—"}
                </bdi>
              </span>
            </div>
          );
        return (
          <div className="flex items-start gap-1.5 rounded-xl bg-a-panel">
            <span className="pt-1">{h.handle}</span>
            <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Input aria-label={t("content.nav.text", { label, n: h.index + 1 })} value={l.label} onChange={(e) => update({ label: e.target.value })} placeholder={placeholder ?? t("content.nav.labelPh")} />
              <LinkInput ariaLabel={t("content.nav.destination", { label, n: h.index + 1 })} value={l.href} targets={targets} placeholder={optionalLink ? t("content.nav.noLinkOptional") : "/collections/all"} onChange={(href, lbl) => update({ href, label: l.label || lbl || "" })} />
            </div>
            <IconBtn icon="close" label={t("content.nav.remove", { label, n: h.index + 1 })} onClick={h.remove} className="mt-0.5" />
          </div>
        );
      }}
    />
  );
}
