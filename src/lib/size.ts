import type { FitTendency, SizeChartKind } from "./types";

export type FitPref = "slim" | "regular" | "relaxed";
export type Body = "women" | "men";

/** Body measurements per size, in cm. `head` labels are English keys — translate with d.product.chart[label]. */
export const CHARTS: Record<Exclude<SizeChartKind, "onesize">, { head: string[]; rows: (string | number)[][] }> = {
  tops: {
    head: ["Size", "Chest", "Waist", "Length", "Sleeve"],
    rows: [
      ["XS", "84–89", "70–75", 66, 60],
      ["S", "89–96", "75–82", 68, 61],
      ["M", "96–104", "82–90", 71, 62],
      ["L", "104–112", "90–98", 73, 63],
      ["XL", "112–120", "98–106", 75, 64],
      ["XXL", "120–128", "106–114", 77, 65],
    ],
  },
  dresses: {
    head: ["Size", "Bust", "Waist", "Hip", "Length"],
    rows: [
      ["XS", "80–84", "62–66", "86–90", 118],
      ["S", "84–88", "66–70", "90–94", 120],
      ["M", "88–94", "70–76", "94–100", 122],
      ["L", "94–100", "76–82", "100–106", 124],
      ["XL", "100–106", "82–88", "106–112", 126],
      ["XXL", "106–112", "88–94", "112–118", 128],
    ],
  },
  bottoms: {
    head: ["Size", "Waist", "Hip", "Inseam", "Thigh"],
    rows: [
      ["XS", "64–70", "86–91", 74, 58],
      ["S", "70–76", "91–96", 76, 61],
      ["M", "76–84", "96–102", 78, 64],
      ["L", "84–92", "102–108", 80, 67],
      ["XL", "92–100", "108–114", 81, 70],
      ["XXL", "100–108", "114–120", 82, 73],
    ],
  },
};

/**
 * Size recommendation from height + weight (+ age band & fit preference).
 * Uses an estimated chest/waist girth regressed from height/weight, mapped
 * onto the product's chart, then nudged by the product's known fit tendency
 * (from review fit feedback) and the shopper's preferred fit.
 */
export function recommend(opts: {
  height: number;
  weight: number;
  body: Body;
  pref: FitPref;
  chart: Exclude<SizeChartKind, "onesize">;
  fit: FitTendency;
  labels: string[];
}) {
  const { height, weight, body, pref, chart, fit, labels } = opts;
  const bmi = weight / (height / 100) ** 2;
  // Approximate girths (cm). Coefficients tuned against common EU size charts.
  const chest = body === "men" ? 0.43 * weight + 0.2 * height + 30 : 0.45 * weight + 0.18 * height + 33;
  const waist = body === "men" ? 0.6 * weight + 0.1 * height + 16 : 0.55 * weight + 0.08 * height + 23;

  const rows = CHARTS[chart].rows;
  const mid = (r: string | number) => {
    const [a, b] = String(r).split("–").map(Number);
    return b ? (a + b) / 2 : a;
  };
  // garment charts list body bust for dresses, which runs ~3 cm under our chest estimate
  const measure = chart === "bottoms" ? waist : chart === "dresses" ? chest - 3 : chest;
  const col = 1;
  // continuous index into the size table
  let idx = 0;
  for (let i = 0; i < rows.length; i++) if (measure >= mid(rows[i][col]) - 3) idx = i;
  const next = rows[idx + 1];
  const frac = next ? (measure - mid(rows[idx][col])) / (mid(next[col]) - mid(rows[idx][col])) : 0;

  let score = idx + Math.max(-0.5, Math.min(1, frac));
  score += pref === "slim" ? -0.45 : pref === "relaxed" ? 0.5 : 0;
  score += fit === "small" ? 0.45 : fit === "large" ? -0.35 : 0;
  if (height > 185 && chart !== "bottoms") score += 0.25; // length matters for tall shoppers

  const pick = Math.max(0, Math.min(rows.length - 1, Math.round(score)));
  const between = Math.abs(score - Math.round(score)) > 0.35;
  const alt = between ? Math.max(0, Math.min(rows.length - 1, score > pick ? pick + 1 : pick - 1)) : null;
  const confidence = Math.round(96 - Math.abs(score - pick) * 40 - (bmi > 32 || bmi < 17 ? 8 : 0));

  const label = String(rows[pick][0]);
  return {
    size: labels.includes(label) ? label : labels[Math.min(pick, labels.length - 1)],
    alt: alt !== null ? String(rows[alt][0]) : null,
    confidence: Math.max(62, Math.min(97, confidence)),
    /** Social-proof stat, derived deterministically from inputs */
    peerShare: Math.max(58, Math.min(91, Math.round(confidence - 6))),
  };
}
