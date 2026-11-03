"use client";

import { AnimatePresence, Reorder, motion } from "motion/react";
import { useState } from "react";
import { cx } from "@/lib/format";
import type { ColorVariant } from "@/lib/types";
import { AIcon } from "../icons";
import { MediaPicker } from "../media-picker";
import { useT } from "../i18n";
import { Badge, Button, IconBtn, Input, ease } from "../ui";
import { permute, useStableKeys } from "./keys";
import { SortableItem, Thumb, move } from "./shared";

export const COLOUR_PRESETS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#1c1c1e" },
  { name: "White", hex: "#f5f5f2" },
  { name: "Bone", hex: "#e9e3d6" },
  { name: "Creme", hex: "#efe6d2" },
  { name: "Grey Heather", hex: "#b9bbbd" },
  { name: "Charcoal", hex: "#3c3d40" },
  { name: "Navy", hex: "#22283a" },
  { name: "Army", hex: "#5d6141" },
  { name: "Dusty Sage", hex: "#a9b9a2" },
  { name: "Sandstone", hex: "#c7a97e" },
  { name: "Brown", hex: "#5a3a2a" },
  { name: "Dusty Pink", hex: "#d6a7ab" },
  { name: "Burgundy", hex: "#6b2737" },
  { name: "Sky", hex: "#a8c5dd" },
];

/** Arabic names for the preset colours — used to suggest colour-name translations (product.ar.colors). */
export const AR_COLOUR_NAMES: Record<string, string> = {
  Black: "أسود",
  White: "أبيض",
  Bone: "عظمي",
  Creme: "كريمي",
  Cream: "كريمي",
  "Grey Heather": "رمادي مُبرقش",
  Grey: "رمادي",
  Charcoal: "فحمي",
  Navy: "كحلي",
  Army: "زيتي",
  Olive: "زيتي",
  "Dusty Sage": "أخضر مريمية",
  Sage: "أخضر مريمية",
  Sandstone: "رملي",
  Sand: "رملي",
  Beige: "بيج",
  Brown: "بني",
  Mocha: "موكا",
  "Dusty Pink": "وردي هادئ",
  Pink: "وردي",
  Burgundy: "عنابي",
  Sky: "سماوي",
  Blue: "أزرق",
  Green: "أخضر",
  Red: "أحمر",
  Stone: "حجري",
  Ecru: "أوف وايت",
  "Off White": "أوف وايت",
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour variants, each with its own reorderable image strip (first image = card image). */
export function ColourMedia({ colors, onChange, error }: { colors: ColorVariant[]; onChange: (c: ColorVariant[]) => void; error?: string | null }) {
  const { t } = useT();
  const k = useStableKeys(colors.length);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [presetsFor, setPresetsFor] = useState<string | null>(null);

  const update = (i: number, patch: Partial<ColorVariant>) => onChange(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addColour = () => {
    const used = new Set(colors.map((c) => c.name.toLowerCase()));
    const preset = COLOUR_PRESETS.find((p) => !used.has(p.name.toLowerCase())) ?? { name: "New colour", hex: "#888888" };
    k.add();
    onChange([...colors, { name: preset.name, hex: preset.hex, images: [] }]);
  };

  return (
    <div>
      {error ? <p className="mb-3 rounded-lg bg-a-danger/10 px-3 py-2 text-[12.5px] text-a-danger">{error}</p> : null}
      <Reorder.Group
        as="div"
        axis="y"
        values={k.keys}
        onReorder={(next: string[]) => {
          onChange(permute(colors, k.keys, next));
          k.set(next);
        }}
        className="space-y-3"
      >
        <AnimatePresence initial={false}>
          {colors.map((c, i) => {
            const key = k.keys[i];
            const badHex = !HEX.test(c.hex);
            return (
              <SortableItem
                key={key}
                value={key}
                index={i}
                count={colors.length}
                label={t("products.variants.dragColour")}
                onMove={(from, to) => {
                  onChange(move(colors, from, to));
                  k.set(move(k.keys, from, to));
                }}
                className="rounded-xl"
              >
                {(handle) => (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.22, ease }} className="rounded-xl border border-a-line bg-a-panel-2/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {handle}
                      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-[10px] ring-1 ring-a-line-strong transition hover:ring-a-accent" style={{ background: badHex ? "transparent" : c.hex }} title={t("products.variants.pickColour")}>
                        <input type="color" aria-label={t("products.variants.swatchFor", { name: c.name || t("products.media.colour") })} value={badHex ? "#888888" : c.hex} onChange={(e) => update(i, { hex: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                      </label>
                      <Input aria-label={t("products.variants.colourName")} value={c.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={t("products.variants.colourName")} className="min-w-[120px] flex-1" />
                      <Input dir="ltr" aria-label={t("products.variants.colourHexAria", { n: i + 1 })} value={c.hex} onChange={(e) => update(i, { hex: e.target.value.trim() })} className={cx("w-[104px] font-mono text-[12.5px]", badHex && "border-a-danger")} maxLength={7} />
                      <IconBtn icon="palette" label={t("products.variants.presets")} aria-expanded={presetsFor === key} onClick={() => setPresetsFor((p) => (p === key ? null : key))} className={presetsFor === key ? "bg-a-panel-2 text-a-text" : ""} />
                      <IconBtn
                        icon="trash"
                        label={t("products.variants.removeX", { name: c.name || t("products.media.colour") })}
                        disabled={colors.length <= 1}
                        onClick={() => {
                          k.remove(i);
                          onChange(colors.filter((_, j) => j !== i));
                        }}
                        className="hover:text-a-danger disabled:opacity-30"
                      />
                    </div>

                    <AnimatePresence initial={false}>
                      {presetsFor === key ? (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden">
                          <div className="flex flex-wrap gap-1.5 pt-3">
                            {COLOUR_PRESETS.map((p) => (
                              <button
                                key={p.name}
                                type="button"
                                onClick={() => {
                                  update(i, { hex: p.hex, name: !c.name.trim() || c.name === "New colour" || COLOUR_PRESETS.some((x) => x.name === c.name) ? p.name : c.name });
                                  setPresetsFor(null);
                                }}
                                className={cx("flex h-7 items-center gap-1.5 rounded-full bg-a-ink/[0.04] ps-1 pe-2.5 text-[12px] text-a-dim ring-1 ring-a-line transition hover:text-a-text hover:ring-a-line-strong", c.hex.toLowerCase() === p.hex && "text-a-text ring-a-violet/50")}
                              >
                                <span className="size-5 rounded-full ring-1 ring-a-ink/15" style={{ background: p.hex }} />
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <ImageStrip images={c.images} colour={c.name} onChange={(images) => update(i, { images })} onAdd={() => setPickFor(i)} />
                  </motion.div>
                )}
              </SortableItem>
            );
          })}
        </AnimatePresence>
      </Reorder.Group>

      <Button type="button" icon="plus" size="sm" onClick={addColour} className="mt-3">
        {t("products.variants.addColour")}
      </Button>

      <MediaPicker
        open={pickFor !== null}
        onClose={() => setPickFor(null)}
        multiple
        productShot
        title={pickFor !== null ? t("products.media.imagesFor", { name: colors[pickFor]?.name || t("products.media.colour") }) : t("products.media.chooseImages")}
        onSelect={(urls) => {
          if (pickFor === null) return;
          const cur = colors[pickFor]?.images ?? [];
          update(pickFor, { images: [...cur, ...urls.filter((u) => !cur.includes(u))] });
        }}
      />
    </div>
  );
}

function ImageStrip({ images, colour, onChange, onAdd }: { images: string[]; colour: string; onChange: (v: string[]) => void; onAdd: () => void }) {
  const { t, isRtl } = useT();
  const back = isRtl ? "ArrowRight" : "ArrowLeft";
  const fwd = isRtl ? "ArrowLeft" : "ArrowRight";
  return (
    <div className="mt-3">
      <div className="a-scroll -mx-1 overflow-x-auto px-1 pb-1">
        <Reorder.Group as="div" axis="x" values={images} onReorder={onChange} className="flex gap-2">
          <AnimatePresence initial={false}>
            {images.map((src, i) => (
              <Reorder.Item
                as="div"
                key={src}
                value={src}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileDrag={{ scale: 1.05, zIndex: 5 }}
                tabIndex={0}
                aria-label={t("products.media.imageAria", { name: colour, n: i + 1, total: images.length, main: i === 0 ? t("products.media.mainSuffix") : "" })}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === back && i > 0) onChange(move(images, i, i - 1));
                  else if (e.key === fwd && i < images.length - 1) onChange(move(images, i, i + 1));
                  else if (e.key === "Delete" || e.key === "Backspace") onChange(images.filter((x) => x !== src));
                  else return;
                  e.preventDefault();
                }}
                className="group relative w-[76px] shrink-0 cursor-grab touch-none rounded-lg active:cursor-grabbing"
              >
                <Thumb src={src} className="pointer-events-none aspect-[4/5] w-full ring-1 ring-black/5" sizes="80px" />
                {i === 0 ? (
                  <span className="pointer-events-none absolute inset-x-1 bottom-1">
                    <Badge tone="violet" className="h-[18px] w-full justify-center bg-a-panel/90 px-1 text-[10px] backdrop-blur">
                      {t("products.media.main")}
                    </Badge>
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={t("products.media.removeImage", { n: i + 1 })}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onChange(images.filter((x) => x !== src))}
                  className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 group-focus-visible:opacity-100"
                >
                  <AIcon name="close" size={12} strokeWidth={2.2} />
                </button>
              </Reorder.Item>
            ))}
          </AnimatePresence>
          <button type="button" onClick={onAdd} className="grid aspect-[4/5] w-[76px] shrink-0 place-items-center rounded-lg border border-dashed border-a-line-strong text-a-dim transition hover:border-a-accent hover:bg-a-violet/[0.06] hover:text-a-accent">
            <span className="flex flex-col items-center gap-1 text-[11px]">
              <AIcon name="plus" size={16} />
              {t("products.media.add")}
            </span>
          </button>
        </Reorder.Group>
      </div>
      {!images.length ? <p className="mt-1.5 text-[12px] text-a-warn">{t("products.media.formats")}</p> : <p className="mt-1.5 text-[11.5px] text-a-faint">{t("products.media.footer", { images: t("products.media.images", { count: images.length }) })}</p>}
    </div>
  );
}
