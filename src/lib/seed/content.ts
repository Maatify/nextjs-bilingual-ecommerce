/* Initial content & settings — copied into SQLite on first boot. Edit them in /admin. */
import { money } from "../format";
import type { ContentPage, FaqGroup, StoreContent, StoreSettings } from "../types";

export const SEED_SETTINGS: StoreSettings = {
  site: {
    name: "VERDA",
    legalName: "VERDA Studio LLC",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://verda.store",
    description:
      "Heavyweight hoodies, sweatshirts, tees, sweatpants and shorts in every colour. Buy 2 Get 1 Free, cash on delivery across Egypt, free 14-day exchanges.",
    whatsapp: "201000000000",
    phone: "+20 100 000 0000",
    email: "care@verda.store",
    instagram: "https://instagram.com/verda",
    tiktok: "https://tiktok.com/@verda",
    currency: "EGP",
  },
  offer: {
    bogoEnabled: true,
    bogo: { buy: 2, get: 1 },
    multiBuy: { enabled: true, qty: 2, pct: 20 },
    freeShippingAt: 1500,
    giftAt: 3500,
    giftName: "Free canvas tote",
    shipping: 75,
    prepaidDiscountPct: 5,
    codFee: 0,
    protection: 39,
    welcomeCode: "WELCOME10",
    welcomePct: 10,
    cutoffHour: 16,
  },
  promoCodes: [
    { code: "WELCOME10", pct: 10, label: "10% off your first order", active: true, used: 0 },
    { code: "VERDA15", pct: 15, label: "15% off", active: true, used: 0 },
    { code: "SAVE200", amount: 200, label: "EGP 200 off", minSubtotal: 1500, active: true, used: 0 },
  ],
  governorates: [
  { name: "Cairo", rate: 65, days: [1, 2] },
  { name: "Giza", rate: 65, days: [1, 2] },
  { name: "Alexandria", rate: 75, days: [2, 3] },
  { name: "Qalyubia", rate: 75, days: [2, 3] },
  { name: "Sharqia", rate: 85, days: [2, 4] },
  { name: "Dakahlia", rate: 85, days: [2, 4] },
  { name: "Gharbia", rate: 85, days: [2, 4] },
  { name: "Monufia", rate: 85, days: [2, 4] },
  { name: "Beheira", rate: 85, days: [2, 4] },
  { name: "Kafr El Sheikh", rate: 85, days: [2, 4] },
  { name: "Damietta", rate: 85, days: [2, 4] },
  { name: "Port Said", rate: 85, days: [2, 4] },
  { name: "Ismailia", rate: 85, days: [2, 4] },
  { name: "Suez", rate: 85, days: [2, 4] },
  { name: "Faiyum", rate: 95, days: [3, 5] },
  { name: "Beni Suef", rate: 95, days: [3, 5] },
  { name: "Minya", rate: 95, days: [3, 5] },
  { name: "Asyut", rate: 105, days: [3, 5] },
  { name: "Sohag", rate: 105, days: [3, 5] },
  { name: "Qena", rate: 105, days: [3, 5] },
  { name: "Luxor", rate: 105, days: [3, 5] },
  { name: "Aswan", rate: 110, days: [4, 6] },
  { name: "Red Sea", rate: 110, days: [3, 5] },
  { name: "South Sinai", rate: 120, days: [4, 6] },
  { name: "North Sinai", rate: 120, days: [4, 6] },
  { name: "Matrouh", rate: 120, days: [4, 6] },
  { name: "New Valley", rate: 130, days: [5, 7] },
  ],
  payments: { cod: true, card: false, wallet: false, installments: false },
  checkout: { protectionEnabled: true, orderBumpEnabled: true, orderBumpProductId: "p04", expressEnabled: true, expressFee: 60 },
};

export function seedContent(s: StoreSettings): StoreContent {
  const faq: FaqGroup[] = [
  {
    group: "Orders & payment",
    items: [
      { q: "Can I pay cash on delivery?", a: "Yes, in all 27 governorates. Open the package, check it, then pay the courier." },
      { q: "How does Buy 2, Get 1 Free work?", a: "Add any 3 pieces. The lowest-priced one is free. No code needed, and it repeats every 3 pieces." },
      { q: "Can I change or cancel my order?", a: "Message us on WhatsApp within 2 hours of ordering." },
    ],
  },
  {
    group: "Shipping",
    items: [
      { q: "How fast is delivery?", a: `Cairo & Giza: 1–2 business days. Other governorates: 2–7. Orders before ${s.offer.cutoffHour}:00 ship the same day.` },
      { q: "How much is shipping?", a: `From ${money(65)} by governorate. Free over ${money(s.offer.freeShippingAt)}.` },
      { q: "Do you deliver next day?", a: `Yes, in Cairo and Giza for ${money(60)} extra. Order before ${s.offer.cutoffHour}:00.` },
    ],
  },
  {
    group: "Fit & fabric",
    items: [
      { q: "How do your pieces fit?", a: "Boxy and relaxed. Hoodies and tees run roomy — size down for a closer fit. Sweatpants and shorts fit true to size." },
      { q: "Are they really unisex?", a: "Yes. Every piece is cut for all bodies. Women usually size down one." },
      { q: "Will it shrink?", a: "No. Every fabric is pre-shrunk or garment-dyed. Wash cold, hang dry." },
      { q: "Is the white tee see-through?", a: "No. At 240 GSM it's fully opaque." },
    ],
  },
  {
    group: "Returns & exchanges",
    items: [
      { q: "What if it doesn't fit?", a: "Exchange it free within 14 days. Our courier swaps it at your door." },
      { q: "Can I get a refund?", a: "Yes. Return unworn pieces with tags within 14 days. Refunds land within 5 business days." },
    ],
  },
];

  const pages: ContentPage[] = [
  {
    slug: "about",
    title: "Our",
    accent: "story",
    nav: "About",
    description: "VERDA makes heavyweight basics — hoodies, crewnecks, tees, sweatpants and shorts — built to wear every day and last for years.",
    intro: "Heavy fabric. Clean cuts. Every colour. That's the whole idea.",
    sections: [
      {
        heading: "Six pieces, done properly",
        body: ["We make six basics and nothing else. A hoodie, a zip hoodie, a crewneck, a tee, sweatpants and shorts.", "No trends. No filler. Just the pieces you reach for every day."],
      },
      {
        heading: "Heavy on purpose",
        body: ["Weight is what makes a basic feel expensive. Ours drape, hold their shape and get better with every wash."],
        list: ["Fleece: 400 GSM, brushed inside", "Sweatpants: 380 GSM, garment-dyed", "Shorts: 280 GSM heavy jersey", "Tee: 240 GSM combed cotton"],
      },
      {
        heading: "Built to mix",
        body: ["Every colour works with every other colour. Pair a hoodie with sweatpants for a set, or a tee with shorts for summer."],
      },
      {
        heading: "Easy to buy",
        body: ["Cash on delivery, free 14-day exchanges and a WhatsApp team that answers in minutes."],
      },
    ],
  },
  {
    slug: "shipping",
    title: "Shipping &",
    accent: "delivery",
    nav: "Shipping",
    description: `Delivery to all 27 governorates in 1–7 business days. Free over ${money(s.offer.freeShippingAt)}. Cash on delivery and next-day express in Cairo & Giza.`,
    intro: `All of Egypt. Same-day dispatch before ${s.offer.cutoffHour}:00. Free over ${money(s.offer.freeShippingAt)}.`,
    sections: [
      {
        heading: "Times & rates",
        body: ["Business days (Sat–Thu), counted from dispatch."],
        list: [
          "Cairo & Giza — 1–2 days · EGP 65",
          "Alexandria & Qalyubia — 2–3 days · EGP 75",
          "Delta & Canal — 2–4 days · EGP 85",
          "Upper Egypt — 3–5 days · EGP 95–110",
          "Sinai, Matrouh & New Valley — 4–7 days · EGP 120–130",
          `Free standard shipping over ${money(s.offer.freeShippingAt)}`,
        ],
      },
      {
        heading: "Next-day express",
        body: [`Cairo and Giza only, ${money(60)} extra. Order before ${s.offer.cutoffHour}:00.`],
      },
      {
        heading: "Cash on delivery",
        body: ["Open the package, check your pieces, then pay the courier.", "We confirm every cash order on WhatsApp first. Confirmed orders ship first."],
      },
      {
        heading: "Tracking",
        body: ["You get a tracking link on WhatsApp once it ships. Or use the Track Order page."],
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns &",
    accent: "exchanges",
    nav: "Returns",
    description: "Free 14-day size exchanges at your door, and easy returns on unworn pieces at VERDA.",
    intro: "Wrong size? We swap it free, at your door.",
    sections: [
      {
        heading: "Free exchanges",
        body: ["Within 14 days of delivery. Send your order number and new size on WhatsApp. The courier brings the new one and takes the old one in a single visit."],
        list: ["Unworn, unwashed, tags on", "One free exchange per piece", "We hold your new size as soon as you message"],
      },
      {
        heading: "Refunds",
        body: [
          "Return unworn pieces within 14 days. Pickup costs EGP 50, free if the item is faulty.",
          "Refunds land within 5 business days. Cash orders go to your wallet, InstaPay or bank. Card orders go back to the card.",
        ],
      },
      {
        heading: "Faulty or wrong item",
        body: ["Tell us within 48 hours with a photo. We replace it free or refund in full, shipping included."],
      },
    ],
  },
  {
    slug: "size-guide",
    title: "Size",
    accent: "guide",
    nav: "Size guide",
    description: "VERDA size charts for hoodies, crewnecks, tees, sweatpants and shorts (XS–XXL), in centimetres.",
    intro: "Body measurements in cm. Every piece is unisex, XS to XXL.",
    sections: [
      {
        heading: "Quick fit notes",
        body: ["Tops are boxy. Bottoms fit true with a relaxed leg."],
        list: ["Hoodie & tee — roomy. Size down for a closer fit", "Crewneck & zip hoodie — true to size", "Sweatpants & shorts — true to size, drawcord waist", "Women — usually one size down"],
      },
      {
        heading: "How to measure",
        body: ["Soft tape, light clothing, snug but not tight."],
        list: ["Chest — fullest part, under the arms", "Waist — narrowest part of your torso", "Hip — fullest part of your hips", "Inseam — crotch to ankle bone, inside leg"],
      },
    ],
  },
  {
    slug: "faq",
    title: "Help &",
    accent: "FAQ",
    nav: "FAQ",
    description: "Answers about cash on delivery, shipping, fit, Buy 2 Get 1 and free exchanges at VERDA.",
    intro: "Quick answers. Still stuck? WhatsApp us.",
    sections: [],
  },
  {
    slug: "contact",
    title: "Get in",
    accent: "touch",
    nav: "Contact",
    description: "Contact VERDA on WhatsApp, phone or email. Real people, fast replies, 7 days a week.",
    intro: "Real people. WhatsApp is fastest — about 10 minutes.",
    sections: [],
  },
  {
    slug: "privacy",
    title: "Privacy",
    accent: "policy",
    nav: "Privacy",
    description: "How VERDA collects, uses and protects your personal information.",
    intro: "Updated 1 October 2026. We collect only what we need. We never sell your data.",
    sections: [
      { heading: "What we collect", body: ["Name, phone, address and (optionally) email when you order.", "Basic device data through cookies, to keep your bag and improve the site."] },
      { heading: "How we use it", body: ["To deliver and confirm orders, send updates you asked for and prevent fraud. Offers only with your consent."] },
      { heading: "Who sees it", body: ["Our couriers get your delivery details. Licensed payment providers handle payments. We never sell or rent your data."] },
      { heading: "Your choices", body: [`Ask to see, fix or delete your data at ${s.site.email}. Unsubscribe from offers with one tap.`] },
    ],
  },
  {
    slug: "terms",
    title: "Terms of",
    accent: "service",
    nav: "Terms",
    description: "The terms that apply when you shop at VERDA.",
    intro: `These terms cover every order on ${s.site.url.replace("https://", "")}. Placing an order means you agree.`,
    sections: [
      { heading: "Prices", body: ["Prices are in EGP and include VAT. If a price is clearly wrong, we may cancel the order and refund you in full."] },
      { heading: "Offers", body: ["Buy 2, Get 1 Free makes the lowest-priced piece in every 3 free. One discount code per order. Codes have no cash value."] },
      { heading: "Delivery", body: ["Ownership passes to you on delivery. Dates are estimates; we'll keep you updated."] },
      { heading: "Law", body: ["These terms follow the laws of the Arab Republic of Egypt."] },
    ],
  },
];


  return {
    announcement: [
      { label: "Buy 2 Get 1 Free", href: "/collections/all" },
      { label: "Cash on delivery", href: "/pages/shipping" },
      { label: "Free exchange", href: "/pages/returns" },
    ],
    ribbons: {
      a: ["Heavyweight drop '26", "Buy 2 Get 1 Free", "400 GSM fleece", "Cash on delivery"],
      b: ["8 colours", "Free 14-day exchange", "Unisex fit", "Made for Egypt"],
    },
    home: {
      hero: {
        eyebrow: "New season · 400 GSM",
        title: "Heavyweight drop '26",
        subtitle: "Thick fleece and boxy tees in every colour.",
        primary: { label: "Shop bestsellers", href: "/collections/bestsellers" },
        secondary: { label: "New drop", href: "/collections/new" },
        images: ["/p/hoodie/sandstone-1.webp", "/p/crew/dusty-sage-1.webp", "/p/hoodie/black-1.webp"],
        featuredProductId: "p01",
      },
      sections: (["hero", "ribbons", "categories", "edit", "matching-set", "colour-story", "reviews", "trust", "faq"] as const).map((id) => ({ id, enabled: true })),
      editTitle: "Shop the edit",
      setTitle: "Wear it as a set",
      colourStoryTitle: "8 colours. One hoodie.",
    },
    nav: [
      { label: "Shop all", href: "/collections/all" },
      { label: "Hoodies", href: "/collections/hoodies" },
      { label: "Sweatshirts", href: "/collections/sweatshirts" },
      { label: "Tees", href: "/collections/tees" },
      { label: "Sweatpants", href: "/collections/sweatpants" },
      { label: "Shorts", href: "/collections/shorts" },
      { label: "Sale", href: "/collections/sale" },
    ],
    footer: [
      { title: "Shop", links: [{ label: "All products", href: "/collections/all" }, { label: "Bestsellers", href: "/collections/bestsellers" }, { label: "New drop", href: "/collections/new" }, { label: "Hoodies", href: "/collections/hoodies" }, { label: "Tees", href: "/collections/tees" }, { label: "Sweatpants", href: "/collections/sweatpants" }] },
      { title: "Help", links: [{ label: "Track order", href: "/track-order" }, { label: "Shipping", href: "/pages/shipping" }, { label: "Returns", href: "/pages/returns" }, { label: "Size guide", href: "/pages/size-guide" }, { label: "FAQ", href: "/pages/faq" }] },
      { title: "About", links: [{ label: "Our story", href: "/pages/about" }, { label: "Contact", href: "/pages/contact" }, { label: "Privacy", href: "/pages/privacy" }, { label: "Terms", href: "/pages/terms" }] },
    ],
    faq,
    pages: pages.map((p) => ({ ...p, published: true })),
    popups: { welcome: true, welcomeDelaySec: 40, socialProof: true, whatsapp: true },
  };
}
