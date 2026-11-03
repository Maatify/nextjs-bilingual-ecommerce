import { getProducts } from "./catalog";
import { categoryName, colorName } from "./i18n/store/content";
import type { Product } from "./types";

/** Normalise for matching: lowercase, drop Arabic tashkeel/tatweel, unify alef/yeh/teh-marbuta forms, strip punctuation. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[-_/.,'’"()]+/g, " ");

/** English plural → singular ("hoodies" → "hoodie", "shorts" kept), Arabic leading "ال" dropped. */
const stem = (w: string) => {
  if (/^ال.{2,}/.test(w)) w = w.slice(2);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && w !== "shorts" && w !== "pants") return w.slice(0, -1);
  return w;
};

/** What shoppers type → words that exist in the catalog (English + Egyptian Arabic). */
const SYNONYMS: Record<string, string[]> = {
  tshirt: ["tee"], "t shirt": ["tee"], shirt: ["tee"], tee: ["tee"], top: ["tee", "crewneck"],
  hoody: ["hoodie"], hood: ["hoodie"], jacket: ["zip", "hoodie"], zipper: ["zip"],
  sweater: ["crewneck", "sweatshirt"], jumper: ["crewneck", "sweatshirt"], pullover: ["hoodie", "crewneck"], crew: ["crewneck"],
  jogger: ["sweatpants"], joggers: ["sweatpants"], trackpants: ["sweatpants"], pants: ["sweatpants"], trousers: ["sweatpants"], bottoms: ["sweatpants", "shorts"],
  short: ["shorts"], grey: ["grey", "gray", "heather"], gray: ["grey", "heather"], beige: ["sand", "khaki", "creme", "bone", "sandstone"],
  cream: ["creme", "bone"], green: ["army", "sage", "olive"], brown: ["brown", "chocolate", "mushroom"], blue: ["navy"],
  // Egyptian Arabic
  "هودي": ["hoodie"], "هوديز": ["hoodie"], "هودى": ["hoodie"], "سويتشيرت": ["crewneck", "sweatshirt"], "سويت شيرت": ["crewneck", "sweatshirt"],
  "تيشيرت": ["tee"], "تيشرت": ["tee"], "تي شيرت": ["tee"], "تى شيرت": ["tee"], "بنطلون": ["sweatpants"], "بنطلونات": ["sweatpants"], "سويت بانتس": ["sweatpants"],
  "شورت": ["shorts"], "شورتات": ["shorts"], "سحاب": ["zip"], "سوستة": ["zip"], "اسود": ["black"], "ابيض": ["white"], "رمادي": ["grey", "heather"], "كحلي": ["navy"],
  "بيج": ["sand", "khaki", "creme", "bone"], "اخضر": ["army", "sage"], "بني": ["brown", "chocolate"],
  "سويتشرت": ["crewneck", "sweatshirt"], "سويت شرت": ["crewneck", "sweatshirt"], "ترنج": ["sweatpants"], "ترينج": ["sweatpants"], "جوجر": ["sweatpants"], "بناطيل": ["sweatpants"],
  "بنطلون سويت": ["sweatpants"], "سوسته": ["zip"], "كابيشون": ["hoodie"], "اوفر سايز": ["oversized"], "اوفرسايز": ["oversized"], "زيتي": ["army", "olive"], "روز": ["pink"], "بينك": ["pink"], "كريمي": ["creme"],
};

/** Levenshtein distance capped at 2 — cheap typo tolerance ("hodie", "sweetpants"). */
function near(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > 2) return false;
  }
  return prev[b.length] <= (a.length >= 7 ? 2 : 1);
}

function expand(q: string): string[][] {
  // multi-word synonyms first ("t shirt", "سويت بانتس"), then single words
  let text = norm(q).trim();
  const groups: string[][] = [];
  for (const key of Object.keys(SYNONYMS).filter((k) => k.includes(" "))) {
    if (text.includes(key)) {
      groups.push([key.replace(/\s/g, ""), ...SYNONYMS[key]]);
      text = text.replace(key, " ");
    }
  }
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const s = stem(w);
    groups.push([...new Set([w, s, ...(SYNONYMS[w] ?? []), ...(SYNONYMS[s] ?? [])])]);
  }
  return groups;
}

/**
 * Product search used by the search overlay and /search: matches English AND Arabic fields
 * whatever the page language, with plurals, synonyms (EN + Egyptian Arabic) and typo tolerance.
 * Every typed word must match something; title hits rank above other fields.
 */
export function searchProducts(q: string): Product[] {
  const groups = expand(q);
  if (!groups.length) return [];
  return getProducts()
    .map((p) => {
      const a = p.ar ?? {};
      const titles = norm(`${p.title} ${a.title ?? ""} ${p.category} ${categoryName(p, "ar")}`);
      const hay = norm(
        `${p.gender} ${p.colors.map((c) => `${c.name} ${colorName(p, c.name, "ar")}`).join(" ")} ${p.collections.join(" ")} ${p.material} ${a.material ?? ""}`,
      );
      // match whole words by prefix (as-you-type), never mid-word: "tshirt" must not hit "sweaTSHIRTs"
      const words = (str: string) => str.split(/\s+/).filter(Boolean).flatMap((w) => [w, stem(w)]);
      const titleWords = words(titles);
      const hayWords = words(hay);
      const tokens = [...titleWords, ...hayWords].filter((t) => t.length > 2);
      let score = 0;
      for (const alts of groups) {
        let best = -1;
        for (const t of alts) {
          if (!t) continue;
          if (titleWords.some((w) => w.startsWith(t))) best = Math.max(best, 4);
          else if (hayWords.some((w) => w.startsWith(t))) best = Math.max(best, 2);
          else if (t.length >= 4 && tokens.some((tok) => near(t, tok))) best = Math.max(best, 1);
        }
        if (best < 0) return { p, score: -1 };
        score += best;
      }
      return { p, score: score + p.rating / 10 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    // when some products match strongly (e.g. the title), drop weak side-matches (typo/tag-only)
    .filter((x, _, all) => x.score >= all[0].score * 0.6)
    .map((x) => x.p);
}
