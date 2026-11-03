"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * - Product shots (/public/p) and admin uploads (/media) are pre-encoded WebP at full width and 480w — pick the
 *   smallest file that covers the requested width (no optimizer round-trip).
 * - Unsplash is an imgix CDN — let it resize/encode instead of proxying originals.
 */
export default function loader({ src, width, quality }: ImageLoaderProps) {
  if ((src.startsWith("/p/") || src.startsWith("/media/")) && src.endsWith(".webp")) return width <= 520 ? src.replace(/\.webp$/, "-480.webp") : src;
  if (!src.startsWith("https://images.unsplash.com")) return src;
  return `${src}?w=${width}&q=${quality ?? 70}&auto=format&fit=crop`;
}
