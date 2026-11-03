"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { categoryFromTag, deleteTags, mergeTags, renameTag } from "@/app/admin/(panel)/tags/actions";
import { cx } from "@/lib/format";
import { useT } from "../i18n";
import { AIcon } from "../icons";
import { Button, Checkbox, ConfirmButton, EmptyState, Field, Input, Modal, PageHeader, Select, ease, toast } from "../ui";
import { Thumb } from "./shared";

export interface TagRow {
  tag: string;
  count: number;
  active: number;
  images: string[];
  categories: { handle: string; title: string }[];
}

export function TagsManager({ rows, orphanCategories }: { rows: TagRow[]; orphanCategories: { handle: string; title: string; tag: string }[] }) {
  const { t: tr, isRtl, fmt } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const t = q.trim().toLowerCase();
  const visible = useMemo(() => rows.filter((r) => !t || r.tag.toLowerCase().includes(t)), [rows, t]);
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.tag));
  const toggle = (tag: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(tag)) n.delete(tag);
      else n.add(tag);
      return n;
    });

  const done = (msg: string, sub?: string) => {
    toast.success(msg, sub);
    setSelected(new Set());
    router.refresh();
  };

  const remove = async (tags: string[]) => {
    const res = await deleteTags(tags);
    if (!res.ok) return toast.error(tr("catalog.categories.toast.deleteFailed"), res.error);
    done(tags.length === 1 ? tr("catalog.tags.toast.deletedOne", { tag: tags[0] }) : tr("catalog.tags.toast.deleted", { count: tags.length }), tr("catalog.tags.toast.removedFrom", { count: res.data?.products ?? 0 }));
  };

  const makeCategory = async (tag: string) => {
    setBusy(tag);
    const res = await categoryFromTag(tag);
    setBusy(null);
    if (!res.ok) return toast.error(tr("catalog.tags.toast.categoryFailed"), res.error);
    done(tr("catalog.tags.toast.categoryCreated"), tr("catalog.tags.toast.categoryCreatedBody", { tag }));
  };

  return (
    <>
      <PageHeader
        title={tr("catalog.tags.title")}
        description={tr("catalog.tags.description")}
        actions={
          <Button icon="layers" disabled={selected.size < 2} onClick={() => setMergeOpen(true)}>
            {selected.size >= 2 ? tr("catalog.tags.mergeN", { count: selected.size }) : tr("catalog.tags.merge")}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
          <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
          <Input aria-label={tr("catalog.tags.search")} placeholder={tr("catalog.tags.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
        </div>
        <AnimatePresence>
          {selected.size ? (
            <motion.div initial={{ opacity: 0, x: isRtl ? 6 : -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRtl ? 6 : -6 }} transition={{ duration: 0.18, ease }} className="flex items-center gap-2">
              <span className="text-[12.5px] text-a-dim">{tr("common.selected", { count: selected.size })}</span>
              <ConfirmButton onConfirm={() => remove([...selected])} confirmLabel={tr("catalog.tags.removeAll", { count: selected.size })}>
                {tr("common.delete")}
              </ConfirmButton>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="overflow-hidden rounded-2xl border border-a-line bg-a-panel">
        <div className="grid grid-cols-[28px_minmax(0,1fr)_72px] items-center gap-3 border-b border-a-line px-3 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-a-faint md:grid-cols-[28px_minmax(0,1.2fr)_120px_minmax(0,1fr)_96px] md:px-4">
          <Checkbox checked={allChecked} onChange={(v) => setSelected(v ? new Set(visible.map((r) => r.tag)) : new Set())} label={<span className="sr-only">{tr("catalog.list.selectAll")}</span>} />
          <span>{tr("catalog.tags.cols.tag")}</span>
          <span className="hidden md:block">{tr("catalog.tags.cols.products")}</span>
          <span className="hidden md:block">{tr("catalog.tags.cols.categories")}</span>
          <span className="text-end">{tr("catalog.categories.cols.count")}</span>
        </div>
        {!visible.length ? (
          <EmptyState icon="tag" title={rows.length ? tr("catalog.tags.noMatch") : tr("catalog.tags.empty")} description={rows.length ? tr("catalog.categories.noMatchBody") : tr("catalog.tags.emptyBody")} />
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {visible.map((r, i) => (
                <motion.li key={r.tag} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: isRtl ? 12 : -12 }} transition={{ duration: 0.24, ease, delay: Math.min(i, 12) * 0.015 }} className={cx("group grid grid-cols-[28px_minmax(0,1fr)_72px] items-start gap-3 border-b border-a-line/70 px-3 py-3 text-[13px] transition-colors last:border-0 hover:bg-a-violet/[0.045] md:grid-cols-[28px_minmax(0,1.2fr)_120px_minmax(0,1fr)_96px] md:px-4", selected.has(r.tag) && "bg-a-violet/[0.05]")}>
                  <span className="pt-0.5">
                    <Checkbox checked={selected.has(r.tag)} onChange={() => toggle(r.tag)} label={<span className="sr-only">{tr("catalog.list.selectOne", { title: r.tag })}</span>} />
                  </span>
                  <div className="min-w-0">
                    {renaming === r.tag ? (
                      <RenameInline tag={r.tag} existing={rows.map((x) => x.tag)} onDone={(ok) => (setRenaming(null), ok && router.refresh())} />
                    ) : (
                      <>
                        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-a-ink/[0.05] px-2.5 font-medium ring-1 ring-inset ring-a-line">
                          <AIcon name="tag" size={12} className="text-a-faint" />
                          {r.tag}
                        </span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          <button type="button" onClick={() => setRenaming(r.tag)} className="text-a-accent hover:underline">
                            {tr("catalog.tags.rename")}
                          </button>
                          <span className="text-a-faint">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(new Set([r.tag]));
                              setMergeOpen(true);
                            }}
                            className="text-a-accent hover:underline"
                          >
                            {tr("catalog.tags.mergeInto")}
                          </button>
                          <span className="text-a-faint">|</span>
                          <Link href={`/admin/products?tag=${encodeURIComponent(r.tag)}`} className="text-a-accent hover:underline">
                            {tr("catalog.tags.viewProducts")}
                          </Link>
                          <span className="text-a-faint">|</span>
                          <ArmedLink label={tr("common.delete")} armedLabel={tr("catalog.tags.removeFrom", { count: r.count })} onConfirm={() => remove([r.tag])} />
                        </div>
                      </>
                    )}
                  </div>
                  <span className="hidden items-center md:flex">
                    {r.images.map((src, j) => (
                      <Thumb key={j} src={src} className={cx("h-9 w-7 ring-2 ring-a-panel", j ? "-ms-2" : "")} sizes="28px" rounded="rounded-md" />
                    ))}
                  </span>
                  <div className="hidden flex-wrap items-center gap-1.5 md:flex">
                    {r.categories.map((c) => (
                      <Link key={c.handle} href="/admin/categories" className="rounded-md bg-a-violet/12 px-2 py-0.5 text-[12px] text-a-accent hover:bg-a-violet/20">
                        {c.title}
                      </Link>
                    ))}
                    {!r.categories.length ? (
                      <Button size="xs" variant="ghost" icon="plus" loading={busy === r.tag} onClick={() => makeCategory(r.tag)}>
                        {tr("catalog.tags.createCategory")}
                      </Button>
                    ) : null}
                  </div>
                  <span className="text-end tabular-nums">
                    <span className="font-medium">{r.count}</span>
                    {r.active !== r.count ? <span className="block text-[11.5px] text-a-faint">{tr("catalog.tags.activeN", { count: r.active })}</span> : null}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {orphanCategories.length ? (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-a-warn">
          <AIcon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>
            {tr("catalog.tags.orphans", { count: orphanCategories.length, names: fmt.list(orphanCategories.map((c) => `“${c.title}”`)), tags: [...new Set(orphanCategories.map((c) => c.tag))].join(", ") })}{" "}
            <Link href="/admin/categories" className="underline">
              {tr("catalog.tags.reviewCategories")}
            </Link>
          </span>
        </p>
      ) : null}

      <MergeModal open={mergeOpen} onClose={() => setMergeOpen(false)} sources={[...selected]} all={rows.map((r) => r.tag)} onMerged={(n) => (setMergeOpen(false), done(tr("catalog.tags.toast.merged"), tr("catalog.list.bulk.updated", { count: n })))} />
    </>
  );
}

function ArmedLink({ label, armedLabel, onConfirm }: { label: string; armedLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" onClick={() => (armed ? onConfirm() : (setArmed(true), setTimeout(() => setArmed(false), 3000)))} className={cx("hover:underline", armed ? "font-medium text-a-danger" : "text-a-danger/85")}>
      {armed ? armedLabel : label}
    </button>
  );
}

function RenameInline({ tag, existing, onDone }: { tag: string; existing: string[]; onDone: (ok: boolean) => void }) {
  const { t: tr } = useT();
  const [v, setV] = useState(tag);
  const [saving, setSaving] = useState(false);
  const next = v.trim().toLowerCase();
  const merges = next !== tag && existing.includes(next);
  const save = async () => {
    if (!next) return;
    setSaving(true);
    const res = await renameTag(tag, next);
    setSaving(false);
    if (!res.ok) return toast.error(tr("catalog.tags.toast.renameFailed"), res.error);
    toast.success(merges ? tr("catalog.tags.toast.mergedInto", { tag: next }) : tr("catalog.tags.toast.renamed", { tag: next }), tr("catalog.list.bulk.updated", { count: res.data?.products ?? 0 }));
    onDone(true);
  };
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label={tr("catalog.tags.newName", { tag })}
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onDone(false);
          }}
          className="h-8 max-w-[220px]"
        />
        <Button size="sm" variant="primary" loading={saving} onClick={save}>
          {tr("common.save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone(false)}>
          {tr("common.cancel")}
        </Button>
      </div>
      {merges ? <p className="text-[12px] text-a-warn">{tr("catalog.tags.exists", { tag: next })}</p> : <p className="text-[12px] text-a-faint">{tr("catalog.tags.appliesAll")}</p>}
    </div>
  );
}

function MergeModal({ open, onClose, sources, all, onMerged }: { open: boolean; onClose: () => void; sources: string[]; all: string[]; onMerged: (n: number) => void }) {
  const { t: tr, fmt } = useT();
  const [target, setTarget] = useState("");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setTarget(sources.length > 1 ? sources[0] : "");
      setCustom("");
    }
  }
  const into = (target === "__new" ? custom : target).trim().toLowerCase();
  const merge = async () => {
    if (!into) return toast.error(tr("catalog.tags.chooseKeep"));
    setSaving(true);
    const res = await mergeTags([...sources], into);
    setSaving(false);
    if (!res.ok) return toast.error(tr("catalog.tags.toast.mergeFailed"), res.error);
    onMerged(res.data?.products ?? 0);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr("catalog.tags.mergeTitle")}
      description={tr("catalog.tags.mergeDescription", { tags: fmt.list(sources.map((s) => `“${s}”`)) })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tr("common.cancel")}
          </Button>
          <Button variant="primary" loading={saving} onClick={merge} disabled={!into}>
            {tr("catalog.tags.mergeBtn")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label={tr("catalog.tags.keep")} htmlFor="merge-target">
          <Select id="merge-target" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">{tr("catalog.tags.choose")}</option>
            {all.map((t) => (
              <option key={t} value={t}>
                {t}
                {sources.includes(t) ? ` ${tr("catalog.tags.selectedMark")}` : ""}
              </option>
            ))}
            <option value="__new">{tr("catalog.tags.newTagName")}</option>
          </Select>
        </Field>
        {target === "__new" ? (
          <Field label={tr("catalog.tags.newTag")} htmlFor="merge-new">
            <Input id="merge-new" autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
