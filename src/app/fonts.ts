import { Anton, Cairo, Geist, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";

/* Latin brand fonts (preloaded) */
export const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
export const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400", display: "swap" });
/* admin-only face (--font-admin): never preloaded, so storefront pages don't download it */
export const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap", preload: false });
export const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });

/*
 * Arabic font: Cairo (variable 200–1000) for everything — body, UI, headings and accents (globals.css points
 * --font-display / --font-serif at it on Arabic pages). Arabic subset only, so Latin runs keep the brand fonts. Preload off and the variable is only attached on Arabic
 * pages (see app/[lang]/layout.tsx), so English visitors never download it.
 */
export const cairo = Cairo({ variable: "--font-ar-sans", subsets: ["arabic"], display: "swap", preload: false });

export const latinFontVars = `${jakarta.variable} ${instrument.variable} ${anton.variable} ${geist.variable}`;
export const arabicFontVars = cairo.variable;
