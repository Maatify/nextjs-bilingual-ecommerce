import type { ProductAr } from "@/lib/types";
import { listProducts, saveProduct } from "@/server/store";

/*
 * Arabic copy for the 6 seeded products. Only applied to a product that still carries its seeded
 * English title (so a re-purposed product never gets unrelated copy), and only to `ar` fields that
 * are still empty — the merchant's own translations always win.
 */

const COLOURS: Record<string, string> = {
  Black: "أسود",
  White: "أبيض",
  "Grey Heather": "رمادي ميلانج",
  "Heather Grey": "رمادي ميلانج",
  "Charcoal Heather": "رمادي غامق ميلانج",
  Bone: "أوف وايت",
  Creme: "كريمي",
  Sandstone: "رملي",
  Army: "زيتي",
  Navy: "كحلي",
  Brown: "بني",
  Chocolate: "شوكولاتة",
  "Dusty Pink": "روز باهت",
  "Dusty Sage": "أخضر سيج",
  Sage: "أخضر سيج",
  Mushroom: "رمادي ترابي",
  Khaki: "كاكي",
  Cement: "أسمنتي",
};

const SEED: Record<string, { en: string; ar: Omit<ProductAr, "colors"> }> = {
  p01: {
    en: "Heavyweight Hoodie",
    ar: {
      title: "هودي تقيل",
      tagline: "قطن 400 جرام ومن جوه وبرة ناعمة. واسع، وكابيشونه طبقتين.",
      description:
        "<p>ده الهودي اللي بنقيس عليه كل حاجة عندنا. قماش 400 جرام تقيل بجد، ومن جوه وبرة ناعمة. الكابيشون طبقتين فبيقف على راسك ومش بيرخي، والأساور والحزام ريب تقيل بيرجع لشكله بعد كل غسلة.</p><p>القصّة واسعة والكتف نازل، فبيقع حلو لوحده أو تحت جاكيت. لو بتحبه مظبوط عليك خد مقاس أصغر.</p>",
      highlights: ["مش بيكش بعد الغسيل", "كابيشون طبقتين", "جيب كانجرو"],
      material: "80% قطن، 20% بوليستر فليس",
      care: ["اغسله على بارد ومقلوب", "من غير مجفف", "اكويه على حرارة هادية"],
      modelInfo: "الموديل طوله 183 سم ووزنه 75 كجم ولابس L",
      category: "هوديز",
      seoTitle: "هودي قطن تقيل 400 جرام | VERDA",
      seoDescription: "هودي قطن تقيل 400 جرام، واسع وكابيشونه طبقتين. الدفع عند الاستلام والتوصيل لكل محافظات مصر.",
    },
  },
  p02: {
    en: "Heavyweight Crewneck",
    ar: {
      title: "سويت شيرت تقيل",
      tagline: "نفس قماش الهودي 400 جرام، من غير كابيشون. والكتف نازل.",
      description:
        "<p>سويت شيرت رقبة مدوّرة بنفس قماش الهودي: 400 جرام، ومن جوه وبرة ناعمة. الريب في الرقبة والأساور والحزام تقيل ومش بيوسع مع الوقت.</p><p>البسه على تيشيرت أو تحت جاكيت، وهتلاقي نفسك لابسه طول الشتا. مقاسه مظبوط، فخد مقاسك العادي.</p>",
      highlights: ["وبرة ناعمة من جوه", "ريب تقيل", "كتف نازل"],
      material: "80% قطن، 20% بوليستر فليس",
      care: ["اغسله على بارد ومقلوب", "انشره مفرود", "اكويه على حرارة هادية"],
      modelInfo: "الموديل طوله 180 سم ووزنه 72 كجم ولابس M",
      category: "سويت شيرت",
      seoTitle: "سويت شيرت قطن تقيل 400 جرام | VERDA",
      seoDescription: "سويت شيرت رقبة مدوّرة قطن تقيل 400 جرام وكتف نازل. الدفع عند الاستلام والتوصيل لكل مصر.",
    },
  },
  p03: {
    en: "Heavyweight Zip Hoodie",
    ar: {
      title: "هودي سوستة تقيل",
      tagline: "أكتر هودي بيتباع عندنا، بس بسوستة كاملة. والسوستة معدن.",
      description:
        "<p>نفس الفليس التقيل بسوستة كاملة. السوستة معدن وبتقفل ناعمة، والكابيشون مبطّن، والجيوب جانبية ومفصولة.</p><p>هتلبسه على أي حاجة كل ليلة، وقماشه يستحمل سنين.</p>",
      highlights: ["سوستة معدن", "كابيشون مبطّن", "جيوب جانبية"],
      material: "80% قطن، 20% بوليستر فليس",
      care: ["اغسله على بارد والسوستة مقفولة", "من غير مجفف", "اكويه على حرارة هادية"],
      modelInfo: "الموديل طوله 185 سم ووزنه 78 كجم ولابس L",
      category: "هوديز",
      seoTitle: "هودي سوستة قطن تقيل 400 جرام | VERDA",
      seoDescription: "هودي قطن تقيل 400 جرام بسوستة معدن كاملة وكابيشون مبطّن. الدفع عند الاستلام والتوصيل لكل مصر.",
    },
  },
  p04: {
    en: "Heavyweight Tee",
    ar: {
      title: "تيشيرت تقيل",
      tagline: "قطن 240 جرام مصبوغ بعد الخياطة. واسع وماسك نفسه.",
      description:
        "<p>التيشيرت اللي هتلبسه كل يوم. قطن 240 جرام مصبوغ بعد الخياطة، فاللون ثابت والقطعة مش بتكش. الرقبة ماسكة نفسها ومش بتوسع، والجسم واسع وبيقع مظبوط.</p><p>كل ما تغسله يبقى أنعم. وهو بييجي واسع، فلو بتحبه مظبوط عليك خد مقاس أصغر.</p>",
      highlights: ["الرقبة مش بتوسع", "مصبوغ بعد الخياطة", "مش بيكش بعد الغسيل"],
      material: "100% قطن ممشّط، مصبوغ بعد الخياطة",
      care: ["اغسله على 30 درجة", "لو هتستخدم مجفف خليه على حرارة واطية", "اكويه مقلوب"],
      modelInfo: "الموديل طوله 180 سم ووزنه 74 كجم ولابس M",
      category: "تيشيرتات",
      seoTitle: "تيشيرت قطن تقيل 240 جرام | VERDA",
      seoDescription: "تيشيرت قطن تقيل 240 جرام، واسع ورقبته مش بتوسع. الدفع عند الاستلام في كل محافظات مصر.",
    },
  },
  p05: {
    en: "Heavyweight Sweatpants",
    ar: {
      title: "بنطلون سويت تقيل",
      tagline: "رجل واسعة وأستك عند الكعب. بيتلبس مع أي هودي.",
      description:
        "<p>بنطلون سويت فليس تقيل مصبوغ بعد الخياطة. الرجل واسعة ومريحة وقافلة بأستك تحت، والوسط أستك برباط، والجيوب عميقة.</p><p>البسه طقم مع الهودي أو السويت شيرت.</p>",
      highlights: ["جيوب جانبية عميقة", "وسط برباط", "أستك عند الكعب"],
      material: "فليس قطن 100%، مصبوغ بعد الخياطة",
      care: ["اغسله على بارد", "انشره في الهوا", "اكويه على حرارة هادية"],
      modelInfo: "الموديل طوله 178 سم ووزنه 70 كجم ولابس M",
      category: "بناطيل سويت",
      seoTitle: "بنطلون سويت قطن تقيل | VERDA",
      seoDescription: "بنطلون سويت قطن تقيل برجل واسعة وأستك عند الكعب. اطلبه طقم مع الهودي، والدفع عند الاستلام.",
    },
  },
  p06: {
    en: "Heavy Jersey Shorts",
    ar: {
      title: "شورت جيرسيه تقيل",
      tagline: "جيرسيه تقيل، وطول الرجل 7 بوصة (حوالي 18 سم). شورت الصيف.",
      description:
        "<p>شورت قطن جيرسيه تقيل مصبوغ بعد الخياطة. طول الرجل من جوه 7 بوصة، والوسط أستك برباط، وفيه جيوب جانبية.</p><p>معمول لصيف مصر: القماش بيهوّي، ومع كده تقيل ومش بيشف.</p>",
      highlights: ["طول 7 بوصة", "جيوب جانبية", "وسط برباط"],
      material: "100% قطن جيرسيه تقيل",
      care: ["اغسله على 30 درجة", "لو هتستخدم مجفف خليه على حرارة واطية"],
      modelInfo: "الموديل طوله 182 سم ووزنه 74 كجم ولابس M",
      category: "شورتات",
      seoTitle: "شورت قطن جيرسيه تقيل | VERDA",
      seoDescription: "شورت قطن جيرسيه تقيل بطول 7 بوصة لصيف مصر. الدفع عند الاستلام والتوصيل لكل المحافظات.",
    },
  },
};

const empty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);

export function arSeedProducts(): boolean {
  for (const p of listProducts()) {
    const seed = SEED[p.id];
    if (!seed || p.title.trim() !== seed.en) continue;
    const ar: ProductAr = { ...p.ar };
    let changed = false;
    for (const [k, v] of Object.entries(seed.ar) as [keyof Omit<ProductAr, "colors">, ProductAr[keyof ProductAr]][]) {
      if (empty(ar[k]) && !empty(v)) {
        (ar as Record<string, unknown>)[k] = v;
        changed = true;
      }
    }
    const colors = { ...ar.colors };
    for (const c of p.colors) {
      const name = COLOURS[c.name];
      if (name && empty(colors[c.name])) {
        colors[c.name] = name;
        changed = true;
      }
    }
    if (Object.keys(colors).length) ar.colors = colors;
    if (changed) saveProduct({ ...p, ar });
  }
  return true;
}
