"use client";

import { AnimatePresence, Reorder, motion } from "motion/react";
import { useRef } from "react";
import { useT } from "../i18n";
import { Button, IconBtn, Input, ease } from "../ui";
import { permute, useStableKeys } from "./keys";
import { SortableItem, move } from "./shared";

/** Editable, reorderable list of short strings (highlights, care lines…). */
export function ListEditor({ value, onChange, placeholder, addLabel, max = 12, label, inputProps }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string; max?: number; label: string; inputProps?: React.InputHTMLAttributes<HTMLInputElement> }) {
  const { t } = useT();
  const k = useStableKeys(value.length);
  const wrap = useRef<HTMLDivElement>(null);

  const add = () => {
    k.add();
    onChange([...value, ""]);
    requestAnimationFrame(() => {
      const inputs = wrap.current?.querySelectorAll("input");
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  return (
    <div ref={wrap}>
      <Reorder.Group
        as="div"
        axis="y"
        values={k.keys}
        onReorder={(next: string[]) => {
          onChange(permute(value, k.keys, next));
          k.set(next);
        }}
        className="space-y-1.5"
      >
        <AnimatePresence initial={false}>
          {value.map((line, i) => (
            <SortableItem
              key={k.keys[i]}
              value={k.keys[i]}
              index={i}
              count={value.length}
              onMove={(from, to) => {
                onChange(move(value, from, to));
                k.set(move(k.keys, from, to));
              }}
            >
              {(handle) => (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="flex items-center gap-1.5 bg-a-panel">
                  {handle}
                  <Input
                    {...inputProps}
                    aria-label={t("products.list.item", { label, n: i + 1 })}
                    value={line}
                    placeholder={placeholder}
                    onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (value.length < max) add();
                      }
                    }}
                    className="flex-1"
                  />
                  <IconBtn
                    icon="close"
                    label={t("products.list.remove", { label, n: i + 1 })}
                    onClick={() => {
                      k.remove(i);
                      onChange(value.filter((_, j) => j !== i));
                    }}
                  />
                </motion.div>
              )}
            </SortableItem>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      {value.length < max ? (
        <Button type="button" size="sm" variant="ghost" icon="plus" onClick={add} className="mt-2">
          {addLabel ?? t("products.list.addLine")}
        </Button>
      ) : null}
    </div>
  );
}
