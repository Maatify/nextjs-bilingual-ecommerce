import { cx } from "@/lib/format";

/** Class names for press depth + pointer ripple (needs <FxRuntime /> mounted for the ripple). */
export const pressClass = "fx-press";
/** Class + attribute for the magnetic hover-lift (primary CTAs). */
export const magnetic = { className: "fx-magnetic", "data-magnetic": "0.22" } as const;
/** Class for the cursor-following spotlight on cards/panels (element must be `relative`). */
export const spotClass = "fx-spot";

/** Wrapper that gives any block press depth + ripple. */
export function Press({ children, className, as: Tag = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "span" }) {
  return <Tag className={cx("relative", pressClass, className)}>{children}</Tag>;
}
