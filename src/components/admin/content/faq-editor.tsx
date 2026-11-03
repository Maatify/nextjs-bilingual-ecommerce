"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { saveFaq, type FaqGroupInput } from "@/app/admin/(panel)/faq/actions";
import { cx } from "@/lib/format";
import type { AdminLocale } from "@/lib/i18n/admin";
import { countPairs } from "@/lib/i18n/admin/completeness";
import { AIcon } from "../icons";
import { arProps, ContentLangTabs, TranslationMeter, useT } from "../i18n";
import { Badge, Button, Card, Checkbox, ease, EmptyState, IconBtn, Input, LinkButton, PageHeader, SaveBar, Textarea, useDraft } from "../ui";
import { Sortable } from "./sortable";
import { useSaver } from "./use-saver";

type Item = FaqGroupInput["items"][number];

export function faqCompleteness(d: FaqGroupInput[]) {
  return countPairs(d.flatMap((g): [unknown, unknown][] => [[g.group, g.ar], ...g.items.flatMap((i): [unknown, unknown][] => [[i.q, i.arQ], [i.a, i.arA]])]));
}
const itemMissing = (i: Item) => (!!i.q.trim() && !i.arQ?.trim()) || (!!i.a.trim() && !i.arA?.trim());

export function FaqEditor({ saved }: { saved: FaqGroupInput[] }) {
  const { t } = useT();
  const [draft, setDraft, dirty, reset] = useDraft(saved);
  const [save, saving] = useSaver(saveFaq, t("content.faq.saved"));
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<AdminLocale>("en");
  const [missingOnly, setMissingOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const ar = lang === "ar";
  const meter = faqCompleteness(draft);

  const setGroup = (gi: number, patch: Partial<FaqGroupInput>) => setDraft((d) => d.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setItem = (gi: number, ii: number, patch: Partial<Item>) => setDraft((d) => d.map((g, i) => (i === gi ? { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : g)));
  const total = draft.reduce((n, g) => n + g.items.length, 0);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const missing = ar && missingOnly;
    if (!s && !missing) return null;
    return draft.flatMap((g, gi) => g.items.map((it, ii) => ({ gi, ii, group: (ar && g.ar) || g.group, it })).filter(({ it }) => (!s || `${it.q} ${it.a} ${it.arQ ?? ""} ${it.arA ?? ""}`.toLowerCase().includes(s)) && (!missing || itemMissing(it))));
  }, [draft, q, ar, missingOnly]);

  return (
    <>
      <PageHeader
        title={t("content.faq.title")}
        description={t("content.faq.description")}
        actions={
          <>
            <TranslationMeter done={meter.done} total={meter.total} />
            <ContentLangTabs value={lang} onChange={setLang} arDone={meter.done} arTotal={meter.total} />
            <LinkButton href={ar ? "/ar/pages/faq" : "/pages/faq"} external iconRight="external">
              {t("content.faq.view")}
            </LinkButton>
            {ar ? null : (
              <Button variant="primary" icon="plus" onClick={() => setDraft((d) => [...d, { group: "", items: [{ q: "", a: "" }] }])}>
                {t("content.faq.newGroup")}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input aria-label={t("content.faq.search")} placeholder={t("content.faq.search")} value={q} onChange={(e) => setQ(e.target.value)} prefix={<AIcon name="search" size={14} />} className="w-full sm:w-80 [&_input]:ps-9" />
        <span className="text-[12.5px] text-a-dim">{t("content.faq.counts", { groups: draft.length, questions: total })}</span>
        {ar ? <Checkbox checked={missingOnly} onChange={setMissingOnly} label={<span className="text-[12.5px] text-a-dim">{t("content.faq.missingOnly")}</span>} /> : null}
      </div>

      {matches ? (
        <Card padded={false} title={q.trim() ? t("content.faq.results", { count: matches.length, q }) : t("common.translation.missingArabic")} description={t("content.faq.resultsDesc")}>
          {matches.length === 0 ? (
            <EmptyState icon="search" title={t("content.faq.noMatch")} description={t("content.faq.noMatchDesc")} />
          ) : (
            <ul className="divide-y divide-a-line/70">
              {matches.map(({ gi, ii, group, it }) => (
                <li key={`${gi}-${ii}`} className="space-y-2 px-5 py-4">
                  <Badge tone="violet">{group || t("content.faq.untitledGroup")}</Badge>
                  <ItemFields item={it} ar={ar} onChange={(p) => setItem(gi, ii, p)} label={t("content.faq.questionN", { group, n: ii + 1 })} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : draft.length === 0 ? (
        <Card>
          <EmptyState icon="faq" title={t("content.faq.none")} description={t("content.faq.noneDesc")} action={<Button variant="primary" icon="plus" onClick={() => setDraft([{ group: t("content.faq.firstGroup"), items: [{ q: "", a: "" }] }])}>{t("content.faq.addFirst")}</Button>} />
        </Card>
      ) : (
        <Sortable
          items={draft}
          onChange={setDraft}
          label={t("content.faq.group")}
          disabled={ar}
          className="space-y-4"
          render={(g, h) => {
            const isOpen = !collapsed.has(h.index);
            return (
              <section className="rounded-2xl border border-a-line bg-a-panel">
                <header className="flex items-center gap-2 p-3 pe-3.5">
                  {h.handle}
                  {ar ? (
                    <Input aria-label={t("content.faq.arGroupName")} {...arProps} value={g.ar ?? ""} onChange={(e) => setGroup(h.index, { ar: e.target.value })} placeholder={g.group} title={t("content.englishOriginal", { value: g.group })} className="max-w-[320px] font-semibold" />
                  ) : (
                    <Input aria-label={t("content.faq.groupName", { n: h.index + 1 })} value={g.group} onChange={(e) => setGroup(h.index, { group: e.target.value })} placeholder={t("content.faq.groupNamePh")} className="max-w-[320px] font-semibold" />
                  )}
                  <span className="ms-auto hidden text-[12px] text-a-faint sm:inline">{t("content.faq.questions", { count: g.items.length })}</span>
                  <IconBtn
                    icon="chevronDown"
                    label={isOpen ? t("content.faq.collapse") : t("content.faq.expand")}
                    aria-expanded={isOpen}
                    className={cx("transition-transform", !isOpen && "-rotate-90 rtl:rotate-90")}
                    onClick={() =>
                      setCollapsed((c) => {
                        const n = new Set(c);
                        if (n.has(h.index)) n.delete(h.index);
                        else n.add(h.index);
                        return n;
                      })
                    }
                  />
                  {ar ? null : <IconBtn icon="trash" label={t("content.faq.deleteGroup", { name: g.group })} onClick={h.remove} className="hover:text-a-danger" />}
                </header>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
                      <div className="border-t border-a-line px-3 pb-3 pt-3">
                        {g.items.length === 0 ? <p className="py-4 text-center text-[12.5px] text-a-dim">{t("content.faq.noQuestions")}</p> : null}
                        <Sortable
                          items={g.items}
                          onChange={(items) => setGroup(h.index, { items })}
                          label={t("content.faq.question")}
                          disabled={ar}
                          className="space-y-2"
                          render={(it, ih) => (
                            <div className="flex items-start gap-1.5 rounded-xl border border-a-line/70 bg-a-panel-2/50 p-2">
                              <span className="pt-1">{ih.handle}</span>
                              <div className="min-w-0 flex-1">
                                <ItemFields item={it} ar={ar} onChange={(p) => setItem(h.index, ih.index, p)} label={t("content.faq.questionN", { group: g.group, n: ih.index + 1 })} />
                              </div>
                              {ar ? null : <IconBtn icon="close" label={t("content.faq.removeQuestion", { n: ih.index + 1 })} onClick={ih.remove} className="mt-0.5" />}
                            </div>
                          )}
                        />
                        {ar ? null : (
                          <Button size="xs" variant="ghost" icon="plus" className="mt-2" onClick={() => setGroup(h.index, { items: [...g.items, { q: "", a: "" }] })}>
                            {t("content.faq.addQuestion")}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
            );
          }}
        />
      )}

      <SaveBar dirty={dirty} saving={saving} onDiscard={reset} onSave={() => save(draft)} />
    </>
  );
}

function ItemFields({ item, onChange, label, ar }: { item: Item; onChange: (p: Partial<Item>) => void; label: string; ar?: boolean }) {
  const { t } = useT();
  if (ar)
    return (
      <div className="space-y-1.5">
        <Input aria-label={`${label} — ${t("content.faq.arQ")}`} {...arProps} value={item.arQ ?? ""} onChange={(e) => onChange({ arQ: e.target.value })} placeholder={item.q || t("content.faq.arQ")} title={t("content.englishOriginal", { value: item.q })} className="font-medium" />
        <Textarea aria-label={`${label} — ${t("content.faq.arA")}`} {...arProps} rows={2} value={item.arA ?? ""} onChange={(e) => onChange({ arA: e.target.value })} placeholder={item.a || t("content.faq.arA")} className="min-h-[58px] text-a-dim focus:text-a-text" />
      </div>
    );
  return (
    <div className="space-y-1.5">
      <Input aria-label={`${label} — ${t("content.faq.q")}`} value={item.q} onChange={(e) => onChange({ q: e.target.value })} placeholder={t("content.faq.q")} className="font-medium" />
      <Textarea aria-label={`${label} — ${t("content.faq.a")}`} rows={2} value={item.a} onChange={(e) => onChange({ a: e.target.value })} placeholder={t("content.faq.a")} className="min-h-[58px] text-a-dim focus:text-a-text" />
    </div>
  );
}
