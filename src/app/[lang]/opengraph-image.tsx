import "@/server/boot";
import { ImageResponse } from "next/og";
import { bogoLabel } from "@/lib/pricing";
import { LOCALES } from "@/lib/i18n/store/config";
import { getSite } from "@/lib/site";

/** prerender for both languages (the image text stays brand/English — next/og has no Arabic font loaded) */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// `alt` must be a static string export — the brand name is rendered from settings inside the image.
export const alt = "Premium everyday wardrobe, cash on delivery across Egypt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const site = getSite();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#1d3a2a", color: "#ecede8", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", fontSize: 44, letterSpacing: -2, fontFamily: "sans-serif", fontWeight: 700 }}>
          {site.name.toLowerCase()}<span style={{ color: "#a8b699" }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, lineHeight: 1, letterSpacing: -3, fontFamily: "sans-serif", fontWeight: 700 }}>Fewer, better</div>
          <div style={{ fontSize: 92, lineHeight: 1.05, fontStyle: "italic", color: "#a8b699" }}>everyday clothes.</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26, fontFamily: "sans-serif" }}>
          {[bogoLabel(), "Cash on delivery", "Free 14-day exchanges"].filter(Boolean).map((t) => (
            <div key={t} style={{ display: "flex", padding: "12px 24px", borderRadius: 999, background: "rgba(255,255,255,0.1)" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
