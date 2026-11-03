"use client";

import { AnimatePresence, Reorder, useDragControls, type DragControls } from "motion/react";
import { useState } from "react";
import { cx } from "@/lib/format";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { ease } from "../ui";

/*
 * Drag-to-reorder list (motion Reorder) with stable keys, a dedicated drag
 * handle (so inputs inside rows stay usable) and keyboard reordering
 * (focus the handle, press ↑ / ↓).
 */

let seq = 0;
const nextKey = () => `s${++seq}`;

export interface SortableHelpers {
  /** Drag handle button — place it anywhere in the row. */
  handle: React.ReactNode;
  remove: () => void;
  moveBy: (d: number) => void;
  index: number;
  count: number;
}

export function Sortable<T>({
  items,
  onChange,
  render,
  className,
  itemClassName,
  axis = "y",
  disabled,
  label,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  render: (item: T, h: SortableHelpers) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  axis?: "x" | "y";
  disabled?: boolean;
  label?: string;
}) {
  const { t } = useT();
  const [keys, setKeys] = useState<string[]>(() => items.map(nextKey));
  let k = keys;
  if (keys.length !== items.length) {
    // items were added/removed (or reset) from outside — grow/shrink the key list
    k = items.length > keys.length ? [...keys, ...Array.from({ length: items.length - keys.length }, nextKey)] : keys.slice(0, items.length);
    setKeys(k);
  }

  const reorder = (nextKeys: string[]) => {
    const byKey = new Map(k.map((key, i) => [key, items[i]]));
    setKeys(nextKeys);
    onChange(nextKeys.map((key) => byKey.get(key) as T));
  };
  const remove = (i: number) => {
    const nk = k.filter((_, j) => j !== i);
    setKeys(nk);
    onChange(items.filter((_, j) => j !== i));
  };
  const moveBy = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const nk = [...k];
    [nk[i], nk[j]] = [nk[j], nk[i]];
    reorder(nk);
  };

  return (
    <Reorder.Group as="ul" axis={axis} values={k} onReorder={reorder} className={className}>
      <AnimatePresence initial={false}>
        {k.map((key, i) => (
          <SortableRow key={key} value={key} className={itemClassName} disabled={disabled}>
            {(controls) =>
              render(items[i], {
                index: i,
                count: items.length,
                remove: () => remove(i),
                moveBy: (d) => moveBy(i, d),
                handle: disabled ? null : <DragHandle controls={controls} label={t("content.sortable.reorder", { label: label ?? "", n: i + 1 })} onMove={(d) => moveBy(i, d)} axis={axis} />,
              })
            }
          </SortableRow>
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}

function SortableRow({ value, children, className, disabled }: { value: string; children: (c: DragControls) => React.ReactNode; className?: string; disabled?: boolean }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      {...(disabled ? { drag: false as const } : {})}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{ duration: 0.24, ease }}
      whileDrag={{ scale: 1.015, boxShadow: "0 18px 40px -16px var(--a-shadow)", zIndex: 5 }}
      className={cx("relative", className)}
    >
      {children(controls)}
    </Reorder.Item>
  );
}

export function DragHandle({ controls, label, onMove, axis = "y", className }: { controls: DragControls; label: string; onMove: (d: number) => void; axis?: "x" | "y"; className?: string }) {
  const { t, isRtl } = useT();
  return (
    <button
      type="button"
      aria-label={t("content.sortable.dragHint", { label })}
      title={t("content.sortable.dragTitle")}
      onPointerDown={(e) => {
        e.preventDefault();
        controls.start(e);
      }}
      onKeyDown={(e) => {
        // horizontal lists run right-to-left in Arabic: ← moves forward there
        const back = axis === "y" ? "ArrowUp" : isRtl ? "ArrowRight" : "ArrowLeft";
        const fwd = axis === "y" ? "ArrowDown" : isRtl ? "ArrowLeft" : "ArrowRight";
        if (e.key === back || e.key === fwd) {
          e.preventDefault();
          onMove(e.key === back ? -1 : 1);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.focus());
        }
      }}
      className={cx("grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-a-faint transition hover:bg-a-ink/[0.06] hover:text-a-text active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-a-violet/60", className)}
    >
      <AIcon name="drag" size={16} strokeWidth={2.4} />
    </button>
  );
}
