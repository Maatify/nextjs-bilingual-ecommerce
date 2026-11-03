"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useFirstOpen } from "@/components/fx/page-transition";
import { useMemo, useRef, useState } from "react";
import { deleteImage, uploadImages, type LibraryImage } from "@/app/admin/(panel)/media/actions";
import { cx } from "@/lib/format";
import type { MediaUse } from "@/server/queries/catalog";
import { useT } from "../i18n";
import { AIcon } from "../icons";
import { Badge, Button, Checkbox, ConfirmButton, Drawer, EmptyState, Input, PageHeader, Select, Skeleton, Tabs, ease, toast } from "../ui";

export type MediaEntry = LibraryImage & { uses: MediaUse[] };

type Filter = "all" | "upload" | "catalog" | "unused";
type Sort = "newest" | "name" | "size";
const PAGE = 60;

export const fmtBytes = (n?: number) => (n === undefined ? "—" : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function MediaLibrary({ items }: { items: MediaEntry[] }) {
  const { t: tr } = useT();
  const first = useFirstOpen(); // grid stagger only on the page's first open
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [productShot, setProductShot] = useState(true);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState<MediaEntry | null>(null);

  const current = items.find((m) => m.url === openUrl) ?? null;
  if (current && current !== lastOpen) setLastOpen(current);
  const shown = current ?? lastOpen;

  const counts = useMemo(
    () => ({
      all: items.length,
      upload: items.filter((m) => m.source === "upload").length,
      catalog: items.filter((m) => m.source === "catalog").length,
      unused: items.filter((m) => !m.uses.length).length,
      bytes: items.reduce((n, m) => n + (m.size ?? 0), 0),
    }),
    [items],
  );

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const out = items.filter((m) => (filter === "all" || (filter === "unused" ? !m.uses.length : m.source === filter)) && (!t || m.name.toLowerCase().includes(t) || m.uses.some((u) => u.label.toLowerCase().includes(t))));
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "size") out.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    else out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return out;
  }, [items, filter, q, sort]);

  const upload = async (files: FileList | File[]) => {
    const imgs = [...files].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return toast.error(tr("catalog.media.onlyImages"));
    const fd = new FormData();
    imgs.forEach((f) => fd.append("files", f));
    if (productShot) fd.append("productShot", "1");
    setUploading(imgs.length);
    const res = await uploadImages(fd);
    setUploading(0);
    if (!res.ok) return toast.error(tr("catalog.media.uploadFailed"), res.error);
    toast.success(tr("catalog.media.uploaded", { count: res.data?.length ?? 0 }), productShot ? tr("catalog.media.padded") : undefined);
    setFilter((f) => (f === "catalog" ? "all" : f));
    router.refresh();
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
      toast.success(tr("catalog.media.urlCopied"));
    } catch {
      toast.error(tr("catalog.media.copyFailed"));
    }
  };

  const remove = async (m: MediaEntry) => {
    if (!m.id) return;
    const res = await deleteImage(m.id);
    if (!res.ok) return toast.error(tr("catalog.categories.toast.deleteFailed"), res.error);
    toast.success(tr("catalog.media.deleted"), m.name);
    setOpenUrl(null);
    router.refresh();
  };

  return (
    <div
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
      }}
      className="relative"
    >
      <PageHeader
        title={tr("catalog.media.title")}
        description={tr("catalog.media.description")}
        actions={
          <Button variant="primary" icon="upload" loading={!!uploading} onClick={() => file.current?.click()}>
            {tr("catalog.media.uploadImages")}
          </Button>
        }
      />
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => {
          if (e.target.files?.length) upload([...e.target.files]);
          e.target.value = "";
        }} />

      {/* drop zone */}
      <motion.button
        type="button"
        onClick={() => file.current?.click()}
        animate={{ scale: drag ? 1.01 : 1 }}
        transition={{ duration: 0.2, ease }}
        className={cx("mb-5 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-7 text-center transition-colors sm:flex-row sm:gap-4 sm:text-start", drag ? "border-a-accent bg-a-violet/10" : "border-a-line-strong bg-a-panel hover:border-a-accent/60 hover:bg-a-violet/[0.04]")}
      >
        <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl transition", drag ? "a-grad text-white" : "bg-a-panel-2 text-a-accent")}>
          <AIcon name="upload" size={19} />
        </span>
        <span>
          <span className="block text-[14px] font-medium">{drag ? tr("catalog.media.drop") : tr("catalog.media.dropzone")}</span>
          <span className="mt-0.5 block text-[12.5px] text-a-dim">{tr("catalog.media.formats")}</span>
        </span>
      </motion.button>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setLimit(PAGE);
          }}
          items={[
            { value: "all", label: tr("common.all"), count: counts.all },
            { value: "upload", label: tr("catalog.media.uploads"), count: counts.upload },
            { value: "catalog", label: tr("catalog.media.catalog"), count: counts.catalog },
            { value: "unused", label: tr("catalog.media.unused"), count: counts.unused },
          ]}
        />
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-[180px] flex-1 lg:max-w-[240px]">
            <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
            <Input aria-label={tr("catalog.media.search")} placeholder={tr("catalog.media.searchNameProduct")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" />
          </div>
          <Select aria-label={tr("common.sort")} value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-[130px]">
            <option value="newest">{tr("catalog.media.newest")}</option>
            <option value="name">{tr("common.name")}</option>
            <option value="size">{tr("catalog.media.largest")}</option>
          </Select>
          <span className="flex h-9 items-center rounded-[10px] border border-a-line bg-a-panel px-3">
            <Checkbox checked={productShot} onChange={setProductShot} label={<span className="text-[12.5px] text-a-dim">{tr("catalog.media.pad")}</span>} />
          </span>
        </div>
      </div>

      {!list.length && !uploading ? (
        <div className="rounded-2xl border border-a-line bg-a-panel">
          <EmptyState icon="media" title={items.length ? tr("catalog.media.nothingMatches") : tr("catalog.media.empty")} description={items.length ? tr("catalog.media.nothingMatchesBody") : tr("catalog.media.emptyBody")} />
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up${i}`} className="rounded-2xl border border-a-line bg-a-panel p-2">
              <Skeleton className="aspect-[4/5] rounded-xl" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))}
          <AnimatePresence initial={false}>
            {list.slice(0, limit).map((m, i) => (
              <motion.button
                key={m.url}
                type="button"
                layout
                initial={first && { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease, delay: first ? Math.min(i, 12) * 0.025 : 0 } }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setOpenUrl(m.url)}
                className="group rounded-2xl border border-a-line bg-a-panel p-2 text-start transition-[border-color,transform] hover:-translate-y-0.5 hover:border-a-line-strong"
              >
                <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-[#f1f1ee]">
                  <Image src={m.url} alt={m.name} fill loading={i < 6 ? "eager" : undefined} sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute start-1.5 top-1.5 flex gap-1">
                    {m.source === "upload" ? <Badge tone="violet" className="bg-a-panel/85 backdrop-blur">{tr("catalog.media.upload")}</Badge> : null}
                  </span>
                  {m.uses.length ? (
                    <span className="absolute bottom-1.5 start-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">
                      {tr("catalog.media.usedN", { count: m.uses.length })}
                    </span>
                  ) : null}
                </span>
                <span dir="ltr" className="mt-2 block truncate px-0.5 text-start text-[12.5px] font-medium rtl:text-end">{m.name}</span>
                <span className="block px-0.5 text-[11.5px] text-a-faint">
                  {m.width && m.height ? <bdi dir="ltr">{`${m.width}×${m.height}`}</bdi> : null}
                  {m.width && m.height ? " · " : ""}
                  {m.size ? <bdi dir="ltr">{fmtBytes(m.size)}</bdi> : m.source === "catalog" ? tr("catalog.media.catalogPhoto") : "—"}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      {list.length > limit ? (
        <div className="mt-5 flex justify-center">
          <Button onClick={() => setLimit((l) => l + PAGE)}>{tr("catalog.media.showMore", { count: list.length - limit })}</Button>
        </div>
      ) : null}
      <p className="mt-4 text-[12px] text-a-faint">
        {tr("catalog.media.uploadsN", { count: counts.upload })} · <bdi dir="ltr">{fmtBytes(counts.bytes)}</bdi> {tr("catalog.media.stored")}
      </p>

      <Drawer open={!!current} onClose={() => setOpenUrl(null)} title={tr("catalog.media.details")}>
        {shown ? <Details m={shown} onCopy={copy} onDelete={remove} /> : null}
      </Drawer>

      <AnimatePresence>
        {drag ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-a-bg/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-a-accent bg-a-panel/90 px-12 py-10">
              <span className="a-grad grid size-14 place-items-center rounded-2xl text-white">
                <AIcon name="upload" size={24} />
              </span>
              <span className="text-[15px] font-medium">{tr("catalog.media.drop")}</span>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Details({ m, onCopy, onDelete }: { m: MediaEntry; onCopy: (url: string) => void; onDelete: (m: MediaEntry) => Promise<void> }) {
  const { t: tr, fmt } = useT();
  const deletable = m.source === "upload" && !!m.id && !m.uses.length;
  return (
    <div className="grid gap-5">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#f1f1ee]">
        <Image src={m.url} alt={m.name} fill sizes="480px" className="object-contain" />
      </div>
      <div>
        <p dir="ltr" className="break-all text-start text-[14px] font-semibold rtl:text-end">{m.name}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone={m.source === "upload" ? "violet" : "neutral"}>{m.source === "upload" ? tr("catalog.media.upload") : tr("catalog.media.catalogPhoto")}</Badge>
          {m.uses.length ? <Badge tone="green">{tr("catalog.media.inUse")}</Badge> : <Badge tone="amber">{tr("catalog.media.unused")}</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-a-line p-3.5 text-[12.5px]">
        <div>
          <dt className="text-a-faint">{tr("catalog.media.dimensions")}</dt>
          <dd className="mt-0.5 tabular-nums">{m.width && m.height ? <bdi dir="ltr">{`${m.width} × ${m.height}`}</bdi> : tr("catalog.media.catalogShot")}</dd>
        </div>
        <div>
          <dt className="text-a-faint">{tr("catalog.media.fileSize")}</dt>
          <dd className="mt-0.5 tabular-nums"><bdi dir="ltr">{fmtBytes(m.size)}</bdi></dd>
        </div>
        <div>
          <dt className="text-a-faint">{tr("catalog.media.format")}</dt>
          <dd className="mt-0.5">{tr("catalog.media.formatValue")}</dd>
        </div>
        <div>
          <dt className="text-a-faint">{tr("catalog.media.added")}</dt>
          <dd className="mt-0.5">{m.createdAt ? fmt.ago(m.createdAt) : tr("catalog.media.builtIn")}</dd>
        </div>
      </dl>
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-a-dim">URL</p>
        <div className="flex gap-1.5">
          <Input readOnly dir="ltr" value={m.url} aria-label={tr("catalog.media.imageUrl")} onFocus={(e) => e.target.select()} className="font-mono text-[12px]" />
          <Button icon="copy" onClick={() => onCopy(m.url)}>
            {tr("common.copy")}
          </Button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-a-dim">{tr("catalog.media.usedBy")}</p>
        {m.uses.length ? (
          <div className="flex flex-wrap gap-1.5">
            {m.uses.map((u, i) => (
              <Link key={u.label + i} href={u.href} className="inline-flex h-7 items-center gap-1 rounded-full bg-a-ink/[0.04] px-2.5 text-[12px] text-a-dim ring-1 ring-a-line transition hover:text-a-text hover:ring-a-line-strong">
                {u.label}
                <AIcon name="chevronRight" size={12} className="rtl:-scale-x-100" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-a-faint">{tr("catalog.media.notUsed")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-a-line pt-4">
        <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-a-dim transition hover:bg-a-panel-2 hover:text-a-text">
          <AIcon name="external" size={15} className="rtl:-scale-x-100" /> {tr("catalog.media.openOriginal")}
        </a>
        <span className="ms-auto">
          {deletable ? (
            <ConfirmButton onConfirm={() => onDelete(m)} confirmLabel={tr("catalog.categories.clickToDelete")}>
              {tr("catalog.media.deleteImage")}
            </ConfirmButton>
          ) : (
            <span className="text-[12px] text-a-faint">{m.source === "catalog" ? tr("catalog.media.cantDeleteCatalog") : tr("catalog.media.cantDeleteUsed")}</span>
          )}
        </span>
      </div>
    </div>
  );
}
