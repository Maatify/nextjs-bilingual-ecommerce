import { getContent, getSettings, saveContent, saveSettings } from "@/server/store";
import type { ContentPageAr, FaqGroup, NavLink, StoreContentAr } from "@/lib/types";

/*
 * Arabic copy for the seeded store content: pages, FAQ, homepage hero/titles/ribbons, header menu,
 * footer, announcement bar and the store meta description. Only fills Arabic fields that are still
 * empty, and only translates rows whose English text is still the seeded text (labels are matched
 * by value), so a merchant's own edits or translations are never overwritten. Run once per DB
 * (kv flag in ./ar-seed.ts).
 */

const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null);

/** English label → Arabic, for menus, footer and announcement. */
const LABELS: Record<string, string> = {
  "Shop all": "كل المنتجات",
  Hoodies: "هوديز",
  Sweatshirts: "سويت شيرت",
  Tees: "تيشيرتات",
  Sweatpants: "بناطيل سويت",
  Shorts: "شورتات",
  Sale: "تخفيضات",
  Shop: "المنتجات",
  "All products": "كل المنتجات",
  Bestsellers: "الأكثر مبيعًا",
  "New drop": "نزل جديد",
  Help: "المساعدة",
  "Track order": "تتبّع طلبك",
  Shipping: "الشحن",
  Returns: "الاستبدال والاسترجاع",
  "Size guide": "جدول المقاسات",
  FAQ: "الأسئلة الشائعة",
  About: "عن VERDA",
  "Our story": "حكايتنا",
  Contact: "كلّمنا",
  Privacy: "الخصوصية",
  Terms: "الشروط",
  "Buy 2 Get 1 Free": "اشتري 2 والتالتة ببلاش",
  "Cash on delivery": "الدفع عند الاستلام",
  "Free exchange": "استبدال مجاني",
};

const RIBBONS: Record<string, string> = {
  "Heavyweight drop '26": "كولكشن التقيل 2026",
  "Buy 2 Get 1 Free": "اشتري 2 والتالتة ببلاش",
  "400 GSM fleece": "فليس 400 جرام",
  "Cash on delivery": "الدفع عند الاستلام",
  "8 colours": "8 ألوان",
  "Free 14-day exchange": "استبدال مجاني 14 يوم",
  "Unisex fit": "للولاد والبنات",
  "Made for Egypt": "معمول لجو مصر",
};

const HERO = {
  eyebrow: ["New season · 400 GSM", "موسم جديد · قطن 400 جرام"],
  title: ["Heavyweight drop '26", "كولكشن التقيل 2026"],
  subtitle: ["Thick fleece and boxy tees in every colour.", "هوديز فليس تقيلة وتيشيرتات واسعة، بألوان كتير."],
  primaryLabel: ["Shop bestsellers", "شوف الأكثر مبيعًا"],
  secondaryLabel: ["New drop", "نزل جديد"],
} as const;

const TITLES = {
  editTitle: ["Shop the edit", "اخترنالك"],
  setTitle: ["Wear it as a set", "البسه طقم"],
  colourStoryTitle: ["8 colours. One hoodie.", "هودي واحد بـ 8 ألوان"],
} as const;

function faqAr(cutoff: number, freeAt: number, prepaid: number): Record<string, { group: string; items: Record<string, [string, string]> }> {
  const egp = (n: number) => `${n.toLocaleString("en")} جنيه`;
  return {
    "Orders & payment": {
      group: "الطلب والدفع",
      items: {
        "Can I pay cash on delivery?": ["ينفع أدفع عند الاستلام؟", "أيوه، في كل محافظات مصر الـ27. افتح الشحنة وشوف القطع، وبعدها ادفع للمندوب."],
        "Is paying online cheaper?": ["الدفع أونلاين أوفر؟", `أيوه. لو دفعت بالبطاقة أو المحفظة أو إنستاباي بتاخد خصم ${prepaid}% على الطلب.`],
        "How does Buy 2, Get 1 Free work?": ["عرض اشتري 2 والتالتة ببلاش ماشي إزاي؟", "ضيف أي 3 قطع للشنطة، وأرخص واحدة فيهم بتبقى ببلاش. من غير كود، والعرض بيتكرر مع كل 3 قطع."],
        "Can I change or cancel my order?": ["ينفع أعدّل الطلب أو ألغيه؟", "أيوه، ابعتلنا على واتساب خلال ساعتين من الطلب."],
      },
    },
    Shipping: {
      group: "الشحن",
      items: {
        "How fast is delivery?": ["التوصيل بياخد قد إيه؟", `القاهرة والجيزة: يوم ليومين شغل. باقي المحافظات: من 2 لـ 7 أيام. ولو طلبت قبل الساعة ${cutoff}:00 بيتشحن في نفس اليوم.`],
        "How much is shipping?": ["الشحن بكام؟", `من ${egp(65)} على حسب المحافظة، ومجاني للطلبات فوق ${egp(freeAt)}.`],
        "Do you deliver next day?": ["فيه توصيل تاني يوم؟", `أيوه، في القاهرة والجيزة بـ ${egp(60)} زيادة. اطلب قبل الساعة ${cutoff}:00.`],
      },
    },
    "Fit & fabric": {
      group: "المقاسات والخامة",
      items: {
        "How do your pieces fit?": ["المقاسات بتيجي إزاي؟", "الهوديز والتيشيرتات واسعة، فخد مقاس أصغر لو بتحبها أقرب للجسم. بناطيل السويت والشورتات مقاسها مظبوط."],
        "Are they really unisex?": ["هي فعلًا للولاد والبنات؟", "أيوه. كل القطع معمولة تتلبس للاتنين، والبنات غالبًا بياخدوا مقاس أصغر بدرجة."],
        "Will it shrink?": ["بتكش بعد الغسيل؟", "لأ. كل القماش متعالج ضد الكش أو مصبوغ بعد الخياطة. اغسلها على بارد وانشرها في الهوا."],
        "Is the white tee see-through?": ["التيشيرت الأبيض بيشف؟", "لأ. القماش 240 جرام، فمش بيشف خالص."],
      },
    },
    "Returns & exchanges": {
      group: "الاستبدال والاسترجاع",
      items: {
        "What if it doesn't fit?": ["لو المقاس مجاش مظبوط؟", "بدّله مجانًا خلال 14 يوم، والمندوب بيجيلك لحد البيت يبدّله."],
        "Can I get a refund?": ["ينفع أرجّع وآخد فلوسي؟", "أيوه. رجّع القطع اللي متلبستش والتيكت عليها خلال 14 يوم، وفلوسك بترجع خلال 5 أيام عمل."],
      },
    },
  };
}

function pagesAr(cutoff: number, freeAt: number, email: string, host: string): Record<string, ContentPageAr & { _title: string }> {
  const egp = (n: number) => `${n.toLocaleString("en")} جنيه`;
  return {
    about: {
      _title: "Our",
      title: "حكايتنا",
      nav: "عن VERDA",
      description: "VERDA بتعمل هوديز وسويت شيرت وتيشيرتات وبناطيل سويت وشورتات من قطن تقيل، للبس كل يوم ولسنين.",
      intro: "قماش تقيل وقصّات بسيطة وألوان كتير. دي كل الفكرة.",
      sections: [
        { heading: "ست قطع بس، معمولين صح", body: ["بنعمل ست قطع أساسية بس: هودي، وهودي سوستة، وسويت شيرت، وتيشيرت، وبنطلون سويت، وشورت.", "مفيش تريندات بتروح وتيجي. القطع اللي بتمد إيدك عليها كل يوم الصبح وخلاص."] },
        {
          heading: "تقيلة عن قصد",
          body: ["وزن القماش هو اللي بيفرق بين تيشيرت عادي وتيشيرت تحس إنه غالي. القماش التقيل بيقع على الجسم أحسن، ومش بيفقد شكله، وبيبقى أنعم مع الغسيل."],
          list: ["الفليس: 400 جرام، ومن جوه وبرة", "بنطلون السويت: 380 جرام، مصبوغ بعد الخياطة", "الشورت: جيرسيه تقيل 280 جرام", "التيشيرت: 240 جرام قطن ممشّط"],
        },
        { heading: "كله بيتلبس مع بعضه", body: ["الألوان معمولة تمشي مع بعض. البس الهودي مع بنطلون السويت طقم، أو التيشيرت مع الشورت في الصيف."] },
        { heading: "الطلب سهل", body: ["بتدفع لما الطلب يوصلك، والاستبدال مجاني خلال 14 يوم، وعلى واتساب بنرد في دقايق."] },
      ],
    },
    shipping: {
      _title: "Shipping &",
      title: "الشحن",
      accent: "والتوصيل",
      nav: "الشحن",
      description: `بنوصّل لكل محافظات مصر الـ27 من يوم لـ 7 أيام عمل. الشحن مجاني للطلبات فوق ${egp(freeAt)}، والدفع عند الاستلام، وفيه توصيل تاني يوم في القاهرة والجيزة.`,
      intro: `بنوصّل لكل مصر. اطلب قبل الساعة ${cutoff}:00 وطلبك يتشحن في نفس اليوم، والشحن مجاني فوق ${egp(freeAt)}.`,
      sections: [
        {
          heading: "المواعيد والأسعار",
          body: ["المدة بأيام العمل (من السبت للخميس)، وبتتحسب من يوم الشحن."],
          list: [
            "القاهرة والجيزة: يوم ليومين · 65 جنيه",
            "الإسكندرية والقليوبية: من 2 لـ 3 أيام · 75 جنيه",
            "الدلتا ومدن القناة: من 2 لـ 4 أيام · 85 جنيه",
            "الصعيد: من 3 لـ 5 أيام · من 95 لـ 110 جنيه",
            "سيناء ومطروح والوادي الجديد: من 4 لـ 7 أيام · من 120 لـ 130 جنيه",
            `الشحن العادي مجاني للطلبات فوق ${egp(freeAt)}`,
          ],
        },
        { heading: "توصيل تاني يوم", body: [`في القاهرة والجيزة بس، بـ ${egp(60)} زيادة. اطلب قبل الساعة ${cutoff}:00.`] },
        { heading: "الدفع عند الاستلام", body: ["افتح الشحنة وشوف القطع بنفسك، وبعدها ادفع للمندوب.", "بنأكد كل طلب دفع عند الاستلام معاك على واتساب الأول، واللي بيتأكد بيتشحن الأول."] },
        { heading: "تتبّع الشحنة", body: ["أول ما طلبك يتشحن هيوصلك لينك التتبّع على واتساب، أو تابعه من صفحة تتبّع الطلب."] },
      ],
    },
    returns: {
      _title: "Returns &",
      title: "الاستبدال",
      accent: "والاسترجاع",
      nav: "الاستبدال والاسترجاع",
      description: "بدّل المقاس مجانًا خلال 14 يوم والمندوب يجيلك لحد البيت، ورجّع أي قطعة متلبستش بسهولة.",
      intro: "المقاس مجاش مظبوط؟ بنبدّله لك مجانًا لحد باب البيت.",
      sections: [
        {
          heading: "استبدال مجاني",
          body: ["خلال 14 يوم من الاستلام. ابعتلنا رقم الطلب والمقاس اللي عايزه على واتساب، والمندوب يجيبلك الجديد وياخد القديم في نفس المشوار."],
          list: ["متلبستش ومتغسلتش، والتيكت لسه عليها", "استبدال مجاني مرة واحدة لكل قطعة", "أول ما تبعتلنا بنحجزلك المقاس الجديد"],
        },
        {
          heading: "استرجاع الفلوس",
          body: ["رجّع أي قطعة متلبستش خلال 14 يوم. المندوب بياخدها بـ 50 جنيه، ومجانًا لو فيها عيب.", "فلوسك بترجع خلال 5 أيام عمل: لو دفعت عند الاستلام بنحوّلها على محفظتك أو إنستاباي أو حسابك في البنك، ولو دفعت بالبطاقة بترجع على نفس البطاقة."],
        },
        { heading: "لو القطعة فيها عيب أو مش اللي طلبته", body: ["ابعتلنا صورة خلال 48 ساعة، وهنبدّلها مجانًا أو نرجّعلك فلوسك كلها ومعاها مصاريف الشحن."] },
      ],
    },
    "size-guide": {
      _title: "Size",
      title: "جدول",
      accent: "المقاسات",
      nav: "جدول المقاسات",
      description: "جدول مقاسات VERDA للهوديز والسويت شيرت والتيشيرتات وبناطيل السويت والشورتات، من XS لـ XXL بالسنتيمتر.",
      intro: "مقاسات الجسم بالسنتيمتر. كل القطع للجنسين، من XS لـ XXL.",
      sections: [
        {
          heading: "قبل ما تختار مقاسك",
          body: ["القطع اللي فوق واسعة، واللي تحت مقاسها مظبوط والرجل مريحة."],
          list: ["الهودي والتيشيرت: واسعين، فخد مقاس أصغر لو عايزهم أقرب للجسم", "السويت شيرت والهودي السوستة: مقاسهم مظبوط", "بنطلون السويت والشورت: مقاسهم مظبوط، والوسط برباط", "البنات: غالبًا مقاس أصغر بدرجة"],
        },
        {
          heading: "تقيس إزاي",
          body: ["هات مازورة قماش والبس هدوم خفيفة، ولفّها على جسمك من غير ما تشدّها."],
          list: ["الصدر: أعرض حتة تحت الباط", "الوسط: أضيق حتة في وسطك", "الهانش: أعرض حتة فيه", "طول الرجل من جوه: من أول الفخد من جوه لحد عضمة الكعب"],
        },
      ],
    },
    faq: {
      _title: "Help &",
      title: "المساعدة",
      accent: "والأسئلة",
      nav: "الأسئلة الشائعة",
      description: "كل اللي محتاج تعرفه عن الدفع عند الاستلام والشحن والمقاسات وعرض اشتري 2 والتالتة ببلاش والاستبدال المجاني في VERDA.",
      intro: "إجابات سريعة. ولو سؤالك مش هنا، كلّمنا واتساب.",
    },
    contact: {
      _title: "Get in",
      title: "كلّمنا",
      accent: "",
      nav: "كلّمنا",
      description: "كلّم VERDA على واتساب أو بالتليفون أو الإيميل. اللي هيرد عليك واحد من الفريق، مش رد آلي.",
      intro: "اللي بيرد عليك واحد من الفريق. واتساب أسرع حاجة، بنرد في حوالي 10 دقايق.",
    },
    privacy: {
      _title: "Privacy",
      title: "سياسة",
      accent: "الخصوصية",
      nav: "الخصوصية",
      description: "إزاي VERDA بتجمع بياناتك وبتستخدمها وبتحافظ عليها.",
      intro: "آخر تحديث: 1 أكتوبر 2026. مش بناخد غير اللي محتاجينه، ومش بنبيع بياناتك لأي حد.",
      sections: [
        { heading: "بناخد إيه", body: ["لما تطلب: الاسم ورقم الموبايل والعنوان، والإيميل لو حبيت تكتبه.", "بيانات بسيطة عن جهازك من الكوكيز، عشان شنطتك تفضل محفوظة ونحسّن الموقع."] },
        { heading: "بنستخدمها في إيه", body: ["عشان نأكد طلبك ونوصّله، ونبعتلك التحديثات اللي طلبتها، ونمنع الطلبات الوهمية. والعروض مش هتوصلك غير لو وافقت."] },
        { heading: "مين بيشوفها", body: ["شركة الشحن بتاخد بيانات التوصيل بس، والدفع أونلاين بيتم عن طريق شركات دفع مرخّصة. ومش بنبيع بياناتك ولا بنأجّرها لحد."] },
        { heading: "حقك", body: [`لو عايز تشوف بياناتك أو تعدّلها أو تمسحها ابعتلنا على ${email}. وتقدر تلغي اشتراك العروض بضغطة واحدة.`] },
      ],
    },
    terms: {
      _title: "Terms of",
      title: "شروط",
      accent: "الاستخدام",
      nav: "الشروط",
      description: "الشروط اللي بتمشي على أي طلب من VERDA.",
      intro: `الشروط دي بتمشي على كل طلب من ${host}، ولما تأكد طلبك تبقى موافق عليها.`,
      sections: [
        { heading: "الأسعار", body: ["الأسعار بالجنيه المصري وشاملة ضريبة القيمة المضافة. لو حصل غلط واضح في سعر، من حقنا نلغي الطلب ونرجّعلك أي فلوس دفعتها كاملة."] },
        { heading: "العروض", body: ["في عرض اشتري 2 والتالتة ببلاش، أرخص قطعة في كل 3 قطع بتبقى ببلاش. كود خصم واحد بس لكل طلب، والأكواد مش بتتصرف فلوس."] },
        { heading: "التوصيل", body: ["القطع بتبقى ملكك من لحظة ما تستلمها. مواعيد التوصيل تقريبية، وهنبلّغك بأي تأخير."] },
        { heading: "القانون", body: ["الشروط دي خاضعة لقوانين جمهورية مصر العربية."] },
      ],
    },
  };
}

const DESCRIPTION_AR = "هوديز وسويت شيرت وتيشيرتات وبناطيل سويت وشورتات قطن تقيل بألوان كتير. اشتري 2 والتالتة ببلاش، والدفع عند الاستلام في كل مصر، والاستبدال مجاني خلال 14 يوم.";

export function arSeedContent(): boolean {
  const settings = getSettings();
  const content = getContent();
  const { cutoffHour, freeShippingAt, prepaidDiscountPct } = settings.offer;
  const host = settings.site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const ar: StoreContentAr = { ...content.ar };

  // header menu, footer, announcement (aligned by index; only labels we recognise)
  const labels = (links: NavLink[]) => links.map((l) => LABELS[l.label] ?? "");
  if (!has(ar.nav) && content.nav.some((l) => LABELS[l.label])) ar.nav = labels(content.nav);
  if (!has(ar.footer) && content.footer.some((c) => LABELS[c.title] || c.links.some((l) => LABELS[l.label]))) ar.footer = content.footer.map((c) => ({ title: LABELS[c.title] || undefined, links: labels(c.links) }));
  // the storefront swaps the whole announcement list, so untranslated rows keep their English label
  if (!has(ar.announcement) && content.announcement.some((l) => LABELS[l.label])) ar.announcement = content.announcement.map((l) => ({ label: LABELS[l.label] ?? l.label, href: l.href }));

  // ribbons
  if (!has(ar.ribbons?.a) && !has(ar.ribbons?.b)) {
    const tr = (list: string[]) => list.map((x) => RIBBONS[x]).filter((x): x is string => !!x);
    const a = tr(content.ribbons.a);
    const b = tr(content.ribbons.b);
    if (a.length || b.length) ar.ribbons = { a, b };
  }

  // hero + section titles (only when the English is still the seeded copy)
  const hero = { ...ar.hero };
  const en = content.home.hero;
  const enHero = { eyebrow: en.eyebrow, title: en.title, subtitle: en.subtitle, primaryLabel: en.primary.label, secondaryLabel: en.secondary.label };
  for (const k of Object.keys(HERO) as (keyof typeof HERO)[]) if (!has(hero[k]) && enHero[k] === HERO[k][0]) hero[k] = HERO[k][1];
  if (Object.values(hero).some(has)) ar.hero = hero;
  for (const k of Object.keys(TITLES) as (keyof typeof TITLES)[]) if (!has(ar[k]) && content.home[k] === TITLES[k][0]) ar[k] = TITLES[k][1];

  // FAQ: mirrors the English list row-for-row; rows we don't know keep their English text
  if (!has(ar.faq)) {
    const dict = faqAr(cutoffHour, freeShippingAt, prepaidDiscountPct);
    if (content.faq.some((g) => dict[g.group])) {
      ar.faq = content.faq.map((g): FaqGroup => {
        const d = dict[g.group];
        return { group: d?.group ?? g.group, items: g.items.map((i) => ({ q: d?.items[i.q]?.[0] ?? i.q, a: d?.items[i.q]?.[1] ?? i.a })) };
      });
    }
  }

  // pages: fill empty Arabic fields of the seeded pages
  const dict = pagesAr(cutoffHour, freeShippingAt, settings.site.email, host);
  const pages = content.pages.map((p) => {
    const d = dict[p.slug];
    if (!d || p.title !== d._title) return p;
    const cur: ContentPageAr = { ...p.ar };
    const next: ContentPageAr = {
      title: cur.title || d.title,
      // keep the accent paired with the seeded title (a merchant's own title shouldn't get our accent)
      accent: cur.accent || (cur.title ? undefined : d.accent),
      nav: cur.nav || d.nav,
      description: cur.description || d.description,
      intro: cur.intro || d.intro,
      sections: cur.sections?.length ? cur.sections : d.sections,
    };
    return { ...p, ar: JSON.parse(JSON.stringify(next)) as ContentPageAr };
  });

  saveContent({ ...content, pages, ar });

  if (!has(settings.site.descriptionAr)) saveSettings({ ...settings, site: { ...settings.site, descriptionAr: DESCRIPTION_AR } });
  return true;
}
