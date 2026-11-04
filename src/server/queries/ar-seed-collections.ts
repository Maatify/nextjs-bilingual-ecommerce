import type { CollectionAr } from "@/lib/types";
import { listCollections, saveCollection } from "@/server/store";

/*
 * Arabic copy for the seeded categories. Fills ONLY empty `ar` fields, and only when the English
 * text is still the seeded one (a renamed category keeps its Arabic empty so it isn't mistranslated).
 */
type Seed = { en: { title: string; description: string }; ar: Required<Pick<CollectionAr, "title" | "description" | "seoTitle" | "seoDescription">> };

const SEED: Record<string, Seed> = {
  all: {
    en: { title: "Shop All", description: "Heavyweight basics in every colour." },
    ar: { title: "كل المنتجات", description: "هوديز وتيشيرتات وبناطيل سويت قطن تقيل، بألوان كتير.", seoTitle: "كل المنتجات | هوديز وتيشيرتات وبناطيل سويت قطن تقيل", seoDescription: "كل منتجات VEDRA: هوديز وسويت شيرت وتيشيرتات وبناطيل سويت قطن تقيل بألوان كتير. الدفع عند الاستلام والشحن لكل محافظات مصر." },
  },
  bestsellers: {
    en: { title: "Bestsellers", description: "What everyone's wearing right now." },
    ar: { title: "الأكثر مبيعًا", description: "القطع اللي الناس بتطلبها تاني وتالت.", seoTitle: "الأكثر مبيعًا من VEDRA", seoDescription: "أكتر القطع اللي بتتطلب من VEDRA: هوديز وتيشيرتات قطن تقيل. اطلب دلوقتي وادفع عند الاستلام." },
  },
  new: {
    en: { title: "New Drop", description: "Fresh colours, just landed." },
    ar: { title: "نزل جديد", description: "ألوان جديدة لسه نازلة.", seoTitle: "نزل جديد | أحدث ألوان VEDRA", seoDescription: "أحدث الألوان والقطع من VEDRA. قطن تقيل وقصّات واسعة، والدفع عند الاستلام." },
  },
  hoodies: {
    en: { title: "Hoodies", description: "Pullover and zip, 400 GSM." },
    ar: { title: "هوديز", description: "هودي عادي وهودي سوستة، قطن 400 جرام.", seoTitle: "هوديز رجالي وحريمي قطن تقيل 400 جرام", seoDescription: "هوديز VEDRA قطن تقيل 400 جرام، بسوستة أو من غير، بقصّة مريحة وألوان كتير. الدفع عند الاستلام والشحن لكل مصر." },
  },
  sweatshirts: {
    en: { title: "Sweatshirts", description: "Heavyweight crewnecks." },
    ar: { title: "سويت شيرت", description: "سويت شيرت رقبة مدوّرة وقماش تقيل.", seoTitle: "سويت شيرت رقبة مدوّرة قطن تقيل", seoDescription: "سويت شيرت VEDRA رقبة مدوّرة وقطن تقيل بيفضل ماسك شكله بعد الغسيل. اطلب دلوقتي وادفع عند الاستلام." },
  },
  tees: {
    en: { title: "T-Shirts", description: "240 GSM boxy tees." },
    ar: { title: "تيشيرتات", description: "تيشيرتات بوكسي واسعة، قطن 240 جرام.", seoTitle: "تيشيرت قطن تقيل 240 جرام واسع", seoDescription: "تيشيرتات VEDRA قطن تقيل 240 جرام وقصّة بوكسي واسعة، ورقبتها مش بتوسع. اشتري 2 والتالتة ببلاش." },
  },
  sweatpants: {
    en: { title: "Sweatpants", description: "Relaxed, cuffed, heavy." },
    ar: { title: "بناطيل سويت", description: "واسعة ومريحة، بأستك عند الكعب وقماش تقيل.", seoTitle: "بنطلون سويت قطن تقيل مريح", seoDescription: "بناطيل سويت VEDRA قطن تقيل وقصّة مريحة وأستك عند الكعب. تتلبس طقم مع الهودي أو السويت شيرت." },
  },
  shorts: {
    en: { title: "Shorts", description: "Heavy jersey, 7-inch." },
    ar: { title: "شورتات", description: "جيرسيه تقيل، وطول 7 بوصة.", seoTitle: "شورت قطن جيرسيه تقيل 7 بوصة", seoDescription: "شورتات VEDRA من الجيرسيه التقيل بطول 7 بوصة، تتلبس كل يوم في الصيف. الدفع عند الاستلام والشحن لكل المحافظات." },
  },
  men: {
    en: { title: "Men", description: "Every piece is unisex — shop the full range." },
    ar: { title: "رجالي", description: "كل قطعنا للجنسين، فشوف كل المنتجات.", seoTitle: "ملابس رجالي | هوديز وتيشيرتات وبناطيل سويت", seoDescription: "هوديز وسويت شيرت وتيشيرتات وبناطيل سويت رجالي من VEDRA، قطن تقيل. وكل القطع للجنسين." },
  },
  women: {
    en: { title: "Women", description: "Every piece is unisex — size down for a closer fit." },
    ar: { title: "حريمي", description: "كل قطعنا للجنسين. لو عايزاها أقرب للجسم خدي مقاس أصغر.", seoTitle: "ملابس حريمي | هوديز وبناطيل سويت قطن تقيل", seoDescription: "هوديز وبناطيل سويت حريمي من VEDRA، قطن تقيل وقصّات مريحة. كل القطع للجنسين، ولو عايزاها أقرب للجسم خدي مقاس أصغر." },
  },
  basics: {
    en: { title: "Essentials", description: "Buy 2, Get 1 Free on everything." },
    ar: { title: "الأساسيات", description: "اشتري 2 والتالتة ببلاش، على كل المنتجات.", seoTitle: "الأساسيات | اشتري 2 والتالتة ببلاش", seoDescription: "أساسيات VEDRA قطن تقيل للبس كل يوم. اشتري 2 والتالتة ببلاش على كل المنتجات، والدفع عند الاستلام." },
  },
  sale: {
    en: { title: "Sale", description: "Limited-time prices." },
    ar: { title: "تخفيضات", description: "أسعار مخفّضة لفترة محدودة.", seoTitle: "تخفيضات VEDRA", seoDescription: "خصومات لفترة محدودة على هوديز وتيشيرتات وبناطيل سويت VEDRA. الكمية محدودة، اطلب دلوقتي وادفع عند الاستلام." },
  },
};

export function arSeedCollections(): boolean {
  for (const c of listCollections()) {
    const seed = SEED[c.handle];
    if (!seed) continue;
    const cur = c.ar ?? {};
    const next: CollectionAr = { ...cur };
    const titleMatches = c.title.trim() === seed.en.title;
    const descMatches = c.description.trim() === seed.en.description;
    if (titleMatches && !cur.title?.trim()) next.title = seed.ar.title;
    if (descMatches && !cur.description?.trim()) next.description = seed.ar.description;
    if (titleMatches && !c.seoTitle && !cur.seoTitle?.trim()) next.seoTitle = seed.ar.seoTitle;
    if (titleMatches && descMatches && !c.seoDescription && !cur.seoDescription?.trim()) next.seoDescription = seed.ar.seoDescription;
    if (JSON.stringify(next) !== JSON.stringify(cur)) saveCollection({ ...c, ar: next });
  }
  return true;
}
