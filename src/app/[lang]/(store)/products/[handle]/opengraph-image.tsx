import "@/server/boot";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getProduct, getProducts } from "@/lib/catalog";
import { money, pctOff } from "@/lib/format";
import { asLocale } from "@/lib/i18n/store/config";
import { localizeProduct } from "@/lib/i18n/store/content";
import { getSite } from "@/lib/site";

const size = { width: 1200, height: 630 };

/** Per-product og:image:alt (the product title, in the page's language) instead of a generic static string. */
export function generateImageMetadata({ params }: { params: { lang: string; handle: string } }) {
  const base = getProduct(params.handle);
  const title = base ? localizeProduct(base, asLocale(params.lang)).title : getSite().name;
  return [{ id: "card", alt: `${title} — ${getSite().name}`, size, contentType: "image/png" }];
}

export function generateStaticParams() {
  return getProducts().map((p) => ({ handle: p.handle }));
}

/** next/og can't decode WebP — convert the local product shot to a PNG data URL (build-time, via Next's bundled sharp). */
async function productPhoto(src: string) {
  try {
    const sharp = (await import("sharp")).default;
    const buf = await readFile(path.join(process.cwd(), "public", src));
    const png = await sharp(buf).resize(460, 550, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = getProduct(handle);
  if (!p) return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#1d3a2a" }} />, size);
  const off = pctOff(p.price, p.compareAt);
  const photo = await productPhoto(p.colors[0].images[0]);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#ecede8", padding: 40, gap: 48, fontFamily: "sans-serif" }}>
        {photo ? (
          <img src={photo} width={460} height={550} alt="" style={{ borderRadius: 36, objectFit: "cover", background: "#f1f1ee" }} />
        ) : (
          <div style={{ display: "flex", width: 460, height: 550, borderRadius: 36, background: "#f1f1ee" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, color: "#101310" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>{`${getSite().name.toLowerCase()}.`}</div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, marginTop: 28 }}>{p.title}</div>
          <div style={{ fontSize: 26, color: "#3a3f39", marginTop: 18 }}>{p.tagline}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 34 }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: off ? "#b3472f" : "#101310" }}>{money(p.price)}</div>
            {p.compareAt ? <div style={{ fontSize: 28, color: "#6f746d", textDecoration: "line-through" }}>{money(p.compareAt)}</div> : null}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
            {[...(p.reviewCount > 0 ? [`${p.rating}/5 · ${p.reviewCount.toLocaleString("en")} review${p.reviewCount === 1 ? "" : "s"}`] : []), "Cash on delivery", "Free exchange"].map((t) => (
              <div key={t} style={{ display: "flex", background: "#1d3a2a", color: "#fff", borderRadius: 999, padding: "10px 20px", fontSize: 22 }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
