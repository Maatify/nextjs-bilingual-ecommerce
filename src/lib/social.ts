import type { SiteInfo } from "./types";

/** Social networks the admin can link to (Settings → Social media). Order = display order on the storefront. */
export const SOCIAL_NETWORKS = [
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@…" },
  { key: "snapchat", label: "Snapchat", placeholder: "https://snapchat.com/add/…" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…" },
  { key: "x", label: "X", placeholder: "https://x.com/…" },
] as const;

export type SocialKey = (typeof SOCIAL_NETWORKS)[number]["key"];

/** The filled-in profile links, in display order. */
export function socialLinks(site: SiteInfo) {
  return SOCIAL_NETWORKS.map((n) => ({ ...n, href: (site[n.key] ?? "").trim() })).filter((n) => n.href);
}
