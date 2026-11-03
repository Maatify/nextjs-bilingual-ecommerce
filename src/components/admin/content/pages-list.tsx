"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { createPage, setPagePublished } from "@/app/admin/(panel)/pages/actions";
import { cx } from "@/lib/format";
import { AIcon } from "../icons";
import { TranslationMeter, useT } from "../i18n";
import { Badge, Button, Card, ease, EmptyState, Field, Input, Modal, PageHeader, Switch, Tabs, toast } from "../ui";

export interface PageRow {
  slug: string;
  title: string;
  nav: string;
  description: string;
  sections: number;
  published: boolean;
  /** Arabic translation progress */
  ar: { done: number; total: number };
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export function PagesList({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const { t } = useT();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "published" | "hidden" | "missing">("all");
  const missing = (p: PageRow) => p.ar.total > 0 && p.ar.done < p.ar.total;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pages.filter((p) => (tab === "all" || (tab === "missing" ? missing(p) : (tab === "published") === p.published)) && (!s || `${p.title} ${p.nav} ${p.slug}`.toLowerCase().includes(s)));
  }, [pages, q, tab]);

  const create = async () => {
    setBusy(true);
    const res = await createPage({ title, slug: slug || slugify(title) });
    setBusy(false);
    if (!res.ok) return toast.error(t("content.pages.createFailed"), res.error);
    toast.success(t("content.pages.created"), t("content.pages.createdDesc"));
    setOpen(false);
    router.push(`/admin/pages/${res.data?.slug}`);
  };

  const toggle = async (p: PageRow, v: boolean) => {
    setPending((x) => ({ ...x, [p.slug]: v }));
    const res = await setPagePublished(p.slug, v);
    if (!res.ok) {
      toast.error(t("content.pages.updateFailed"), res.error);
      setPending((x) => ({ ...x, [p.slug]: p.published }));
      return;
    }
    toast.success(v ? t("content.pages.isLive", { name: p.nav }) : t("content.pages.isHidden", { name: p.nav }));
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title={t("content.pages.title")}
        description={t("content.pages.description")}
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setTitle("");
              setSlug("");
              setSlugTouched(false);
              setOpen(true);
            }}
          >
            {t("content.pages.newPage")}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: t("common.all"), count: pages.length },
            { value: "published", label: t("content.pages.published"), count: pages.filter((p) => p.published).length },
            { value: "hidden", label: t("content.pages.hidden"), count: pages.filter((p) => !p.published).length },
            { value: "missing", label: t("common.translation.missingArabic"), count: pages.filter(missing).length },
          ]}
        />
        <Input aria-label={t("content.pages.search")} placeholder={t("content.pages.search")} value={q} onChange={(e) => setQ(e.target.value)} prefix={<AIcon name="search" size={14} />} className="ms-auto w-full sm:w-64 [&_input]:ps-9" />
      </div>

      <Card padded={false}>
        {list.length === 0 ? (
          <EmptyState icon="pages" title={pages.length ? t("content.pages.noMatch") : t("content.pages.none")} description={pages.length ? t("content.pages.noMatchDesc") : t("content.pages.noneDesc")} />
        ) : (
          <ul className="divide-y divide-a-line/70">
            <AnimatePresence initial={false}>
              {list.map((p, i) => {
                const live = pending[p.slug] ?? p.published;
                return (
                  <motion.li key={p.slug} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease, delay: Math.min(i, 10) * 0.03 } }} exit={{ opacity: 0 }} className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-a-ink/[0.025] sm:flex-row sm:items-center">
                    <Link href={`/admin/pages/${p.slug}`} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-a-violet/60">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-a-line bg-a-panel-2 text-a-dim transition group-hover:text-a-accent">
                        <AIcon name="pages" size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-medium">{p.title}</span>
                          {live ? <Badge tone="green" dot>{t("content.pages.published")}</Badge> : <Badge>{t("content.pages.hidden")}</Badge>}
                          <TranslationMeter done={p.ar.done} total={p.ar.total} compact className="hidden sm:inline-flex" />
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-a-dim">
                          <bdi dir="ltr" className="font-mono text-[12px] text-a-faint">/pages/{p.slug}</bdi> · {t("content.pages.sections", { count: p.sections })}
                          {p.description ? ` · ${p.description}` : ""}
                        </span>
                      </span>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2 ps-[54px] sm:ps-0">
                      <span className="flex items-center gap-2 text-[12px] text-a-dim">
                        <Switch checked={live} onChange={(v) => toggle(p, v)} />
                        <span className="w-14">{live ? t("content.pages.live") : t("content.pages.hidden")}</span>
                      </span>
                      <a href={`/pages/${p.slug}`} target="_blank" rel="noopener noreferrer" aria-label={t("content.pages.viewOnStore", { name: p.nav })} className={cx("grid size-8 place-items-center rounded-[9px] text-a-dim transition hover:bg-a-panel-2 hover:text-a-text", !live && "pointer-events-none opacity-40")}>
                        <AIcon name="external" size={15} className="rtl:-scale-x-100" />
                      </a>
                      <Link href={`/admin/pages/${p.slug}`} className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-a-panel-2 px-3 text-[13px] font-medium ring-1 ring-a-line transition hover:bg-a-hover">
                        {t("common.edit")}
                      </Link>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("content.pages.newPage")}
        description={t("content.pages.newDesc")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" loading={busy} disabled={!title.trim()} onClick={create}>
              {t("content.pages.createPage")}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create();
          }}
        >
          <Field label={t("content.pages.pageTitle")} htmlFor="np-title">
            <Input
              id="np-title"
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder={t("content.pages.titlePh")}
            />
          </Field>
          <Field label={t("content.pages.url")} htmlFor="np-slug" hint={t("content.pages.urlHint")}>
            <div dir="ltr">
            <Input
              id="np-slug"
              prefix="/pages/"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value.replace(/\s/g, "-")) + (e.target.value.endsWith("-") ? "-" : ""));
              }}
              placeholder="care-guide"
              className="[&_input]:pl-[62px]"
            />
            </div>
          </Field>
          <button type="submit" hidden />
        </form>
      </Modal>
    </>
  );
}
