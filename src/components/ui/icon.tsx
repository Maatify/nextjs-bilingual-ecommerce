import type { SVGProps } from "react";

/** Single inline icon set (24px grid, 1.6 stroke) — no icon-font or library payload. */
const paths = {
  bag: "M6 7h12l1 13H5L6 7Zm3 0V6a3 3 0 0 1 6 0v1",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  menu: "M4 7h16M4 12h16M4 17h10",
  close: "M6 6l12 12M18 6 6 18",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  arrowUpRight: "M7 17 17 7M8 7h9v9",
  arrowLeft: "M19 12H5m5-5-5 5 5 5",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  chevronLeft: "m15 6-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "m5 12.5 4.5 4.5L19 7",
  star: "m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8L12 3.5Z",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  refresh: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5",
  shield: "M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Zm-3 9 2 2 4-4",
  cash: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4m12-4v4",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  ruler: "M4 16 16 4l4 4L8 20l-4-4Zm4-4 2 2m1-5 2 2m1-5 2 2",
  gift: "M4 11h16v9H4zM3 7h18v4H3zm9 0v13M12 7S10.5 3 8 3.5 7.5 7 12 7Zm0 0s1.5-4 4-3.5S16.5 7 12 7Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2",
  eye: "M2.5 12S6 5 12 5s9.5 7 9.5 7S18 19 12 19 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  fire: "M12 21c-3.9 0-7-2.7-7-6.5 0-4 3.5-6 3.5-9.5 2.5 1.5 4 4 4 6 1-1 1.5-2.5 1.5-3.5 2 1.5 5 4.2 5 7 0 3.8-3.1 6.5-7 6.5Z",
  sparkle: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18",
  whatsapp: "M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20Zm5-11c0 3.5 2.5 6 6 6l1-1.5-2-1-1 .8c-1-.5-1.8-1.3-2.3-2.3l.8-1-1-2L9 9Z",
  filter: "M4 6h16M7 12h10m-7 6h4",
  grid: "M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z",
  square: "M5 5h14v14H5z",
  home: "M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z",
  lock: "M6 11h12v9H6zm2 0V8a4 4 0 0 1 8 0v3",
  tag: "M3 12V4h8l9 9-8 8-9-9Zm5-4h.01",
  package: "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12v9m0-9L4 7.5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01",
  map: "M12 21s-6-5.4-6-11a6 6 0 1 1 12 0c0 5.6-6 11-6 11Zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  zoom: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4M11 8v6m-3-3h6",
  share: "M12 4v11M7 9l5-5 5 5M5 14v6h14v-6",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  mail: "M3 6h18v12H3zm0 0 9 7 9-7",
  instagram: "M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm8 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm5-9.5h.01",
  tiktok: "M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.5 2.3 4 5 4",
  facebook: "M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H7v3.5h2V21h3.5v-8.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15V3Z",
  snapchat: "M12 3.5c-3 0-5 2.2-5 5.2v2.1l-1.8.6c.3.9 1.2 1.2 2 1.4-.7 1.6-2 2.8-3.7 3.4.4.8 1.5 1 2.5 1.2.1.6.2 1.2.5 1.3.8.2 1.7-.3 2.8.2.9.4 1.6 1.1 2.7 1.1s1.8-.7 2.7-1.1c1.1-.5 2 0 2.8-.2.3-.1.4-.7.5-1.3 1-.2 2.1-.4 2.5-1.2-1.7-.6-3-1.8-3.7-3.4.8-.2 1.7-.5 2-1.4l-1.8-.6V8.7c0-3-2-5.2-5-5.2Z",
  youtube: "M3 8.5c0-2 1.3-3.1 3-3.2C8 5.1 10 5 12 5s4 .1 6 .3c1.7.1 3 1.2 3 3.2v7c0 2-1.3 3.1-3 3.2-2 .2-4 .3-6 .3s-4-.1-6-.3c-1.7-.1-3-1.2-3-3.2v-7ZM10 9v6l5-3-5-3Z",
  x: "M4 4h4.5L20 20h-4.5L4 4Zm16 0-6.8 7.2M4 20l6.8-7.2",
  thumb: "M7 11v9H4v-9h3Zm0 0 4-7c1.5 0 2.5 1 2.2 2.5L12.5 10H19a1.5 1.5 0 0 1 1.5 1.8l-1.4 6.5A2 2 0 0 1 17.2 20H7",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4",
  sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M15 5v4M9 15v4",
  verified: "M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8L5.7 6.5l.9-2.9 3 .2L12 3Zm-3 9 2 2 4-4",
} as const;

export type IconName = keyof typeof paths;

/** Direction-bearing glyphs mirror automatically in right-to-left text (`.rtl-flip:dir(rtl)` in globals.css). */
const DIRECTIONAL = new Set<IconName>(["arrowRight", "arrowLeft", "arrowUpRight", "chevronRight", "chevronLeft"]);

export function Icon({ name, size = 20, filled, strokeWidth = 1.6, className, ...rest }: SVGProps<SVGSVGElement> & { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={DIRECTIONAL.has(name) ? (className ? `rtl-flip ${className}` : "rtl-flip") : className}
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
