"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { useFx } from "./media";

const SPRING = { stiffness: 220, damping: 22, mass: 0.6 };

/**
 * Pointer-tracked 3D tilt with a moving specular glare.
 * - rotateX/rotateY up to ±`max`°, spring-smoothed, resets on leave.
 * - Children marked with <TiltLayer depth={n}> pop forward (keep them out of overflow-hidden boxes, which flatten 3D).
 * - Inert on touch/coarse pointers and under prefers-reduced-motion. Transform is `none` at rest
 *   so fixed-position descendants (sheets, modals) are never trapped.
 * - The card is only a 3D context (preserve-3d + lifted layers, via [data-tilt] in globals.css) while
 *   hovered: a permanent 3D context makes Firefox draw a hairline seam across large images.
 */
export function Tilt3D({
  children,
  className,
  max = 7,
  perspective = 1000,
  scale = 1.015,
  glare = true,
  glareClassName,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  perspective?: number;
  scale?: number;
  glare?: boolean;
  glareClassName?: string;
  style?: React.CSSProperties;
}) {
  const on = useFx();
  const [active, setActive] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rect = useRef<DOMRect | null>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const hover = useMotionValue(0);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), SPRING);
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), SPRING);
  const sc = useSpring(useTransform(hover, [0, 1], [1, scale]), SPRING);
  const lit = useSpring(hover, { stiffness: 200, damping: 30 });
  const transform = useTransform(() => {
    const a = rx.get();
    const b = ry.get();
    const c = sc.get();
    if (Math.abs(a) < 0.01 && Math.abs(b) < 0.01 && Math.abs(c - 1) < 0.0005) return "none";
    return `perspective(${perspective}px) rotateX(${a.toFixed(3)}deg) rotateY(${b.toFixed(3)}deg) scale(${c.toFixed(4)})`;
  });
  const gx = useTransform(px, (v) => `${(v * 100).toFixed(1)}%`);
  const gy = useTransform(py, (v) => `${(v * 100).toFixed(1)}%`);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, var(--a-glare, rgb(255 255 255 / 0.28)), transparent 58%)`;

  // the rect is cached while hovered (re-measuring a tilted element would feed back), but a scroll
  // moves the element under a still pointer — drop the cache then so the tilt follows the real position
  const unscroll = useRef<(() => void) | null>(null);
  const dropRect = () => (rect.current = null);
  useEffect(
    () => () => {
      unscroll.current?.();
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!on || e.pointerType !== "mouse") return;
    // re-measure at rest geometry: the tilt is ≤ a few degrees, so the layout box (offset size) + current position is enough
    const r = (rect.current ??= untransformedRect(e.currentTarget));
    px.set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    py.set(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };

  return (
    <motion.div
      // will-change only while hovered: at rest it would promote every card to a layer and (like any
      // transform) make the card a containing block for position:fixed descendants
      className={cx("relative", on && "hover:will-change-transform", className)}
      data-tilt={active ? "" : undefined}
      style={{ ...style, transform }}
      onPointerEnter={(e) => {
        if (!on || e.pointerType !== "mouse") return;
        rect.current = e.currentTarget.getBoundingClientRect();
        if (settle.current) clearTimeout(settle.current);
        setActive(true);
        if (!unscroll.current) {
          window.addEventListener("scroll", dropRect, { passive: true, capture: true });
          unscroll.current = () => window.removeEventListener("scroll", dropRect, { capture: true });
        }
        hover.set(1);
        track(e);
      }}
      onPointerMove={track}
      onPointerLeave={() => {
        unscroll.current?.();
        unscroll.current = null;
        rect.current = null;
        hover.set(0);
        px.set(0.5);
        py.set(0.5);
        // flatten again once the spring has settled back to rest
        settle.current = setTimeout(() => setActive(false), 700);
      }}
    >
      {children}
      {glare && on ? (
        <motion.span aria-hidden className={cx("pointer-events-none absolute inset-0 z-[4] rounded-[inherit]", glareClassName)} style={{ backgroundImage: glareBg, opacity: lit }} />
      ) : null}
    </motion.div>
  );
}

/** Viewport rect of an element ignoring its own transform (centre stays put under a scale/rotate about the centre). */
function untransformedRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return new DOMRect(cx - w / 2, cy - h / 2, w, h);
}

/** A child of <Tilt3D> lifted toward the viewer by `depth` px. */
export function TiltLayer({ depth = 24, className, children }: { depth?: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={cx("tilt-z", className)} style={{ "--z": `${depth}px` } as React.CSSProperties}>
      {children}
    </div>
  );
}
