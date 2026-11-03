"use client";

import Image from "next/image";
import { Reorder, useDragControls } from "motion/react";
import { cx } from "@/lib/format";
import type { Product, ProductStatus } from "@/lib/types";
import { useT } from "../i18n";
import { AIcon } from "../icons";
import type { Tone } from "../ui";

/* ───────────── helpers ───────────── */

export const LOW_STOCK = 3;

export const statusTone: Record<ProductStatus, Tone> = { active: "green", draft: "amber", archived: "neutral" };
/** English labels (legacy) — UI should prefer useStatusLabel() / t(`catalog.status.${s}`). */
export const statusLabel: Record<ProductStatus, string> = { active: "Active", draft: "Draft", archived: "Archived" };
/** Localised product status labels. */
export function useStatusLabel(): Record<ProductStatus, string> {
  const { t } = useT();
  return { active: t("catalog.status.active"), draft: t("catalog.status.draft"), archived: t("catalog.status.archived") };
}

export const totalStock = (p: Product) => p.sizes.reduce((n, s) => n + (Number(s.stock) || 0), 0);
export const lowSizes = (p: Product) => p.sizes.filter((s) => s.stock <= LOW_STOCK);

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Move an item within an array (returns a new array). */
export function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/* ───────────── tiny visuals ───────────── */

/** Product photo on the storefront's light well. */
export function Thumb({ src, alt = "", className, sizes = "48px", rounded = "rounded-lg" }: { src?: string; alt?: string; className?: string; sizes?: string; rounded?: string }) {
  return (
    <span className={cx("relative block shrink-0 overflow-hidden bg-[#f1f1ee]", rounded, className)}>
      {src ? <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-black/25"><AIcon name="media" size={16} /></span>}
    </span>
  );
}

export function Swatches({ colors, max = 5, size = 12 }: { colors: { name: string; hex: string }[]; max?: number; size?: number }) {
  const { t } = useT();
  const extra = colors.length - max;
  return (
    <span className="flex items-center" aria-label={t("catalog.shared.colours", { count: colors.length, names: colors.map((c) => c.name).join(", ") })}>
      {colors.slice(0, max).map((c, i) => (
        <span key={c.name + i} title={c.name} className="-ms-1 rounded-full ring-2 ring-a-panel first:ms-0" style={{ width: size, height: size, background: c.hex }} />
      ))}
      {extra > 0 ? <span dir="ltr" className="ms-1 text-[11px] text-a-faint">+{extra}</span> : null}
    </span>
  );
}

/* ───────────── sortable list ───────────── */

/**
 * Reorder.Item with a dedicated drag handle that is also keyboard operable
 * (focus the handle, use ↑/↓). `children` receives the handle element.
 */
export function SortableItem<T>({
  value,
  index,
  count,
  onMove,
  onCommit,
  disabled,
  className,
  axis = "y",
  children,
  label,
}: {
  value: T;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onCommit?: () => void;
  disabled?: boolean;
  className?: string;
  axis?: "x" | "y";
  label?: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const controls = useDragControls();
  const { t, isRtl } = useT();
  const lbl = label ?? t("catalog.shared.dragToReorder");
  const prev = axis === "y" ? "ArrowUp" : isRtl ? "ArrowRight" : "ArrowLeft";
  const next = axis === "y" ? "ArrowDown" : isRtl ? "ArrowLeft" : "ArrowRight";
  const handle = disabled ? null : (
    <button
      type="button"
      aria-label={t("catalog.shared.dragPosition", { label: lbl, pos: index + 1, total: count })}
      title={lbl}
      onPointerDown={(e) => {
        e.preventDefault();
        controls.start(e);
      }}
      onKeyDown={(e) => {
        if (e.key === prev && index > 0) {
          e.preventDefault();
          onMove(index, index - 1);
          onCommit?.();
        } else if (e.key === next && index < count - 1) {
          e.preventDefault();
          onMove(index, index + 1);
          onCommit?.();
        }
      }}
      className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-a-faint transition hover:bg-a-hover hover:text-a-text active:cursor-grabbing"
    >
      <AIcon name="drag" size={16} strokeWidth={2.4} />
    </button>
  );
  return (
    <Reorder.Item
      as="div"
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => onCommit?.()}
      className={cx("relative", className)}
      whileDrag={{ scale: 1.01, zIndex: 5, boxShadow: "0 18px 40px -16px var(--a-shadow)" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    >
      {children(handle)}
    </Reorder.Item>
  );
}

/* ───────────── chips input ───────────── */

export function Chip({ children, onRemove, active, onClick }: { children: React.ReactNode; onRemove?: () => void; active?: boolean; onClick?: () => void }) {
  const { t } = useT();
  const cls = cx(
    "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium ring-1 ring-inset transition",
    active ? "bg-a-violet/15 text-a-accent ring-a-violet/35" : "bg-a-ink/[0.04] text-a-dim ring-a-line hover:text-a-text hover:ring-a-line-strong",
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
        {active ? <AIcon name="check" size={12} strokeWidth={2.4} /> : <AIcon name="plus" size={12} />}
        {children}
      </button>
    );
  return (
    <span className={cls}>
      {children}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={t("common.remove")} className="-me-1 grid size-5 place-items-center rounded-full hover:bg-a-ink/10">
          <AIcon name="close" size={11} />
        </button>
      ) : null}
    </span>
  );
}
