import "@/server/boot";
import type { MetadataRoute } from "next";
import { getSite } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  const site = getSite();
  return {
    name: `${site.name} — Premium Everyday Wardrobe`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ecede8",
    theme_color: "#1d3a2a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
