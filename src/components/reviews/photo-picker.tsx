"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";

export const MAX_PHOTOS = 3;
const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;

type Picked = { file: File; url: string };

/**
 * Up to 3 review photos with instant previews (object URLs, revoked on removal/unmount). Validates size and type
 * in the browser for quick feedback; the server re-checks every byte. Controlled: `files` + `onChange`.
 */
export function PhotoPicker({ id, files, onChange, error }: { id: string; files: File[]; onChange: (files: File[]) => void; error?: string }) {
  const { d, t } = useI18n();
  const T = d.product.reviews;
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [local, setLocal] = useState<string | null>(null);
  // previews for the controlled list; the object URLs are released when the list changes or on unmount
  const picked = useMemo<Picked[]>(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked]);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    let msg: string | null = null;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_PHOTOS) {
        msg = T.photoMax;
        break;
      }
      if (f.type && !OK_TYPES.test(f.type)) {
        msg = T.photoType;
        continue;
      }
      if (f.size > MAX_BYTES) {
        msg = T.photoTooBig;
        continue;
      }
      next.push(f);
    }
    setLocal(msg);
    onChange(next);
    if (input.current) input.current.value = "";
  };

  const shown = error ?? local;
  return (
    <div>
      <p className="mb-1.5 text-[14px] font-medium" id={`${id}-label`}>
        {T.photos} <span className="text-[13px] font-normal text-muted">· {d.checkout.optional}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <AnimatePresence initial={false}>
          {picked.map((p, i) => (
            <motion.div key={`${p.file.name}-${p.file.size}-${p.file.lastModified}`} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="relative size-20 overflow-hidden rounded-xl bg-well">
              <Image src={p.url} alt="" fill sizes="80px" unoptimized className="object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((f) => f !== p.file))}
                aria-label={t(T.removePhoto, { n: i + 1 })}
                className="tap absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-ink/75 text-white transition hover:bg-ink"
              >
                <Icon name="close" size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {files.length < MAX_PHOTOS ? (
          <label
            htmlFor={id}
            className="tap flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink/25 text-[12px] font-medium text-ink-2 transition hover:border-ink/60 hover:bg-surface-2 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ink"
          >
            <Icon name="camera" size={20} />
            {T.addPhotos}
            <input
              ref={input}
              id={id}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="sr-only"
              aria-describedby={hintId}
              aria-invalid={!!shown}
              onChange={(e) => add(e.target.files)}
            />
          </label>
        ) : null}
      </div>
      <p id={hintId} className={cx("mt-1.5 text-[13px]", shown ? "font-medium text-sale" : "text-muted")} role={shown ? "alert" : undefined}>
        {shown ?? T.photosHint}
      </p>
    </div>
  );
}
