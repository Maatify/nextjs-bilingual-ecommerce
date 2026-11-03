import { snapshot } from "./data";
import type { ContentPage, FaqGroup } from "./types";

export type { ContentPage, ContentSection } from "./types";

/* Pages & FAQ — edited in /admin → Content, read from the live snapshot. */

export const getFaq = (): FaqGroup[] => snapshot().content.faq;
export const getPages = (): ContentPage[] => snapshot().content.pages.filter((p) => p.published !== false);
export const getPage = (slug: string) => getPages().find((p) => p.slug === slug);
