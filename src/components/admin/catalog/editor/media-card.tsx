"use client";

import { AnimatePresence, Reorder, motion } from "motion/react";
import { useRef, useState } from "react";
import { uploadImages } from "@/app/admin/(panel)/media/actions";
import { cx } from "@/lib/format";
import type { ColorVariant } from "@/lib/types";
import { AIcon } from "../../icons";
import { MediaPicker } from "../../media-picker";
import { useT } from "../../i18n";
import { Badge, Button, Select, Spinner, ease, toast } from "../../ui";
import { Thumb, move } from "../shared";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";

/**
 * Shopify-style media: one big drop zone (upload or pick from the library) and the
 * images grouped by the colour they belong to. Each colour group is a drop target too.
 */
export function MediaCard({ colors, onChange }: { colors: ColorVariant[]; onChange: (c: ColorVariant[]) => void }) {
  const { t: tr, isRtl } = useT();
  const [target, setTarget] = useState(0);
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [over, setOver] = useState<number | "main" | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const t = Math.min(target, colors.length - 1);

  const addTo = (i: number, urls: string[]) => {
    const cur = colors[i]?.images ?? [];
    onChange(colors.map((c, j) => (j === i ? { ...c, images: [...cur, ...urls.filter((u) => !cur.includes(u))] } : c)));
  };
  const setImages = (i: number, images: string[]) => onChange(colors.map((c, j) => (j === i ? { ...c, images } : c)));

  const upload = async (i: number, list: FileList | File[]) => {
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return toast.error(tr("products.media.onlyImages"));
    const fd = new FormData();
    files.slice(0, 20).forEach((f) => fd.append("files", f));
    fd.append("productShot", "1");
    setBusy(i);
    const res = await uploadImages(fd);
    setBusy(null);
    if (!res.ok || !res.data) return toast.error(tr("products.media.uploadFailed"), res.ok ? undefined : res.error);
    addTo(i, res.data.map((m) => m.url));
    toast.success(tr("products.media.added", { count: res.data.length }), tr("products.media.addedTo", { name: colors[i]?.name ?? "" }));
  };

  const dropProps = (i: number, key: number | "main") => ({
    onDragOver: (e: React.DragEvent) => {
      if (![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault();
      setOver(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setOver(null);
      void upload(i, e.dataTransfer.files);
    },
  });

  const totalImages = colors.reduce((n, c) => n + c.images.length, 0);

  return (
    <div>
      <div
        {...dropProps(t, "main")}
        className={cx(
          "relative grid place-items-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors duration-200",
          over === "main" ? "border-a-violet bg-a-violet/[0.08]" : "border-a-line-strong bg-a-ink/[0.015] hover:border-a-violet/50",
        )}
      >
        <motion.span animate={{ y: over === "main" ? -4 : 0, scale: over === "main" ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 24 }} className="grid size-11 place-items-center rounded-2xl bg-a-violet/12 text-a-accent">
          {busy !== null ? <Spinner size={18} /> : <AIcon name="upload" size={20} />}
        </motion.span>
        <p className="mt-3 text-[13.5px] font-medium">{over === "main" ? tr("products.media.dropTo", { name: colors[t]?.name ?? "" }) : tr("products.media.dragHere")}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="sm" variant="primary" icon="upload" onClick={() => file.current?.click()} disabled={busy !== null}>
            {tr("products.media.uploadNew")}
          </Button>
          <Button type="button" size="sm" icon="media" onClick={() => setPicking(t)}>
            {tr("products.media.selectExisting")}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-a-faint">
          <span>{tr("products.media.addTo")}</span>
          <Select aria-label={tr("products.media.colourTarget")} value={String(t)} onChange={(e) => setTarget(Number(e.target.value))} className="w-[160px] [&_select]:h-8 [&_select]:text-[12.5px]">
            {colors.map((c, i) => (
              <option key={i} value={i}>
                {c.name || tr("products.media.colourN", { n: i + 1 })}
              </option>
            ))}
          </Select>
        </div>
        <p className="mt-2 text-[11.5px] text-a-faint">{tr("products.media.formats")}</p>
        <input
          ref={file}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload(t, e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-4 space-y-3">
        {colors.map((c, i) => (
          <div
            key={i}
            {...dropProps(i, i)}
            className={cx("rounded-xl p-3 ring-1 transition-colors duration-200", over === i ? "bg-a-violet/[0.07] ring-a-violet/60" : "bg-a-panel-2/50 ring-a-line")}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <span className="size-3.5 rounded-full ring-1 ring-a-ink/15" style={{ background: c.hex }} />
              <span className="text-[13px] font-medium">{c.name || tr("products.media.colourN", { n: i + 1 })}</span>
              <span className="text-[12px] text-a-faint">
                {tr("products.media.images", { count: c.images.length })}
              </span>
              {busy === i ? <Spinner size={13} className="text-a-accent" /> : null}
              {!c.images.length ? <Badge tone="amber">{tr("products.media.needsPhoto")}</Badge> : null}
            </div>
            <Reorder.Group as="div" axis="x" values={c.images} onReorder={(v: string[]) => setImages(i, v)} className="a-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <AnimatePresence initial={false}>
                {c.images.map((src, k) => (
                  <Reorder.Item
                    as="div"
                    key={src}
                    value={src}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileDrag={{ scale: 1.05, zIndex: 5 }}
                    transition={{ duration: 0.2, ease }}
                    tabIndex={0}
                    aria-label={tr("products.media.imageAria", { name: c.name, n: k + 1, total: c.images.length, main: k === 0 ? tr("products.media.mainSuffix") : "" })}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === (isRtl ? "ArrowRight" : "ArrowLeft") && k > 0) setImages(i, move(c.images, k, k - 1));
                      else if (e.key === (isRtl ? "ArrowLeft" : "ArrowRight") && k < c.images.length - 1) setImages(i, move(c.images, k, k + 1));
                      else if (e.key === "Delete" || e.key === "Backspace") setImages(i, c.images.filter((x) => x !== src));
                      else return;
                      e.preventDefault();
                    }}
                    className={cx("group relative shrink-0 cursor-grab touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-a-violet active:cursor-grabbing", k === 0 ? "w-[104px]" : "w-[80px]")}
                  >
                    <Thumb src={src} className="pointer-events-none aspect-[4/5] w-full ring-1 ring-black/5" sizes="110px" />
                    {k === 0 ? (
                      <span className="pointer-events-none absolute inset-x-1 bottom-1">
                        <Badge tone="violet" className="h-[18px] w-full justify-center bg-a-panel/90 px-1 text-[10px] backdrop-blur">
                          {tr("products.media.main")}
                        </Badge>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={tr("products.media.removeImage", { n: k + 1 })}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setImages(i, c.images.filter((x) => x !== src))}
                      className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <AIcon name="close" size={12} strokeWidth={2.2} />
                    </button>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
              <button
                type="button"
                onClick={() => setPicking(i)}
                className="grid aspect-[4/5] w-[80px] shrink-0 place-items-center rounded-lg border border-dashed border-a-line-strong text-a-dim transition hover:border-a-accent hover:bg-a-violet/[0.06] hover:text-a-accent"
              >
                <span className="flex flex-col items-center gap-1 text-[11px]">
                  <AIcon name="plus" size={16} />
                  {tr("products.media.add")}
                </span>
              </button>
            </Reorder.Group>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11.5px] text-a-faint">
        {tr("products.media.footer", { images: tr("products.media.images", { count: totalImages }) })}
      </p>

      <MediaPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        multiple
        productShot
        title={picking !== null ? tr("products.media.imagesFor", { name: colors[picking]?.name || tr("products.media.colour") }) : tr("products.media.chooseImages")}
        onSelect={(urls) => {
          if (picking !== null) addTo(picking, urls);
        }}
      />
    </div>
  );
}
