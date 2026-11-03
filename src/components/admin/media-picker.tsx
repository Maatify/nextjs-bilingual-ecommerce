"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { listLibrary, uploadImages, type LibraryImage } from "@/app/admin/(panel)/media/actions";
import { cx } from "@/lib/format";
import { useT } from "./i18n";
import { AIcon } from "./icons";
import { Button, Input, Modal, Skeleton, Tabs, toast } from "./ui";

/**
 * Pick one or many images from the media library (uploads + catalog photos),
 * or upload new ones right here. Returns URLs usable in next/image.
 *
 *   <MediaPicker open={o} onClose={...} multiple onSelect={(urls) => ...} productShot />
 */
export function MediaPicker({ open, onClose, onSelect, multiple, productShot, title }: { open: boolean; onClose: () => void; onSelect: (urls: string[]) => void; multiple?: boolean; productShot?: boolean; title?: string }) {
  const { t } = useT();
  const [items, setItems] = useState<LibraryImage[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "upload" | "catalog">("all");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setPicked([]);
  }

  const load = useCallback(() => {
    listLibrary().then(setItems).catch(() => toast.error(t("catalog.media.loadFailed")));
  }, [t]);
  useEffect(() => {
    if (open && !items) load();
  }, [open, items, load]);

  const upload = async (files: FileList | File[]) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append("files", f));
    if (productShot) fd.append("productShot", "1");
    setBusy(true);
    const res = await uploadImages(fd);
    setBusy(false);
    if (!res.ok) return toast.error(t("catalog.media.uploadFailed"), res.error);
    toast.success(t("catalog.media.uploaded", { count: res.data?.length ?? 0 }));
    const urls = res.data?.map((m) => m.url) ?? [];
    setItems((cur) => [...(res.data ?? []), ...(cur ?? [])]);
    setPicked((p) => (multiple ? [...p, ...urls] : urls.slice(0, 1)));
  };

  const toggle = (url: string) => setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : multiple ? [...p, url] : [url]));
  const list = (items ?? []).filter((m) => (tab === "all" || m.source === tab) && (!q || m.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? t("catalog.picker.title")}
      description={productShot ? t("catalog.picker.productShot") : undefined}
      width="max-w-4xl"
      footer={
        <>
          <span className="me-auto text-[12.5px] text-a-dim">{picked.length ? t("common.selected", { count: picked.length }) : multiple ? t("catalog.picker.selectMany") : t("catalog.picker.selectOne")}</span>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!picked.length}
            onClick={() => {
              onSelect(picked);
              onClose();
            }}
          >
            {multiple ? (picked.length ? t("catalog.picker.addN", { count: picked.length }) : t("common.add")) : t("catalog.picker.use")}
          </Button>
        </>
      }
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Tabs size="sm" value={tab} onChange={setTab} items={[{ value: "all", label: t("common.all") }, { value: "upload", label: t("catalog.media.uploads") }, { value: "catalog", label: t("catalog.media.catalogPhotos") }]} />
          <Input aria-label={t("common.search")} placeholder={t("catalog.media.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          <Button className="ms-auto" icon="upload" loading={busy} onClick={() => file.current?.click()}>
            {t("common.upload")}
          </Button>
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        </div>

        <div className={cx("relative rounded-xl transition", drag && "ring-2 ring-a-violet ring-offset-4 ring-offset-a-panel")}>
          <AnimatePresence>
            {drag ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-a-violet/15 text-[14px] font-medium text-a-accent backdrop-blur-sm">
                {t("catalog.media.drop")}
              </motion.div>
            ) : null}
          </AnimatePresence>
          {!items ? (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/5]" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-a-dim">{t("catalog.picker.empty")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {list.map((m) => {
                const on = picked.includes(m.url);
                return (
                  <button key={m.url} type="button" onClick={() => toggle(m.url)} className={cx("group relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f1f1ee] ring-2 transition", on ? "ring-a-violet" : "ring-transparent hover:ring-a-line-strong")} title={m.name}>
                    <Image src={m.url} alt="" fill sizes="160px" className="object-cover" />
                    <span className={cx("absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full text-white transition", on ? "a-grad scale-100" : "scale-0 bg-black/50")}>
                      <AIcon name="check" size={12} strokeWidth={2.4} />
                    </span>
                    {multiple && on ? <span className="absolute start-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/70 text-[10.5px] font-semibold text-white">{picked.indexOf(m.url) + 1}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
