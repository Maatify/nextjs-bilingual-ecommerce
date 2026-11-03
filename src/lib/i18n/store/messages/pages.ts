import type { Widen } from "../config";

/* Page-level strings: <title>/meta descriptions, content (help) pages. Keep en and ar keys identical. */
export const en = {
  meta: {
    homeTitle: "Heavyweight Basics | Cash on Delivery in Egypt",
  },
  breadcrumb: "Breadcrumb",
  helpPages: "Help pages",
  cm: "cm",
  charts: { tops: "Hoodies, crewnecks & tees", bottoms: "Sweatpants & shorts" },
  chartHead: { Size: "Size", Chest: "Chest", Waist: "Waist", Length: "Length", Sleeve: "Sleeve", Bust: "Bust", Hip: "Hip", Inseam: "Inseam", Thigh: "Thigh" },
  stuck: "Still stuck?",
  waHours: "WhatsApp replies in minutes, 10 AM – 10 PM.",
  chat: "Chat with us",
  contact: {
    whatsapp: "WhatsApp",
    call: "Call",
    email: "Email",
    whatsappNote: "~10 min replies",
    callNote: "10 AM – 10 PM, Sat–Thu",
    emailNote: "Within 24 hours",
    send: "Send a message",
  },
};

export const ar: Widen<typeof en> = {
  meta: {
    homeTitle: "هوديز وتيشيرتات قطن تقيل | الدفع عند الاستلام في مصر",
  },
  breadcrumb: "مكانك في الموقع",
  helpPages: "صفحات المساعدة",
  cm: "سم",
  charts: { tops: "هوديز وسويت شيرت وتيشيرتات", bottoms: "بناطيل سويت وشورتات" },
  chartHead: { Size: "المقاس", Chest: "الصدر", Waist: "الوسط", Length: "الطول", Sleeve: "الكم", Bust: "الصدر", Hip: "الهانش", Inseam: "طول الرجل من جوه", Thigh: "الفخد" },
  stuck: "لسه مش متأكد؟",
  waHours: "بنرد على واتساب في دقايق، من 10 الصبح لـ 10 بالليل.",
  chat: "كلّمنا واتساب",
  contact: {
    whatsapp: "واتساب",
    call: "اتصل بينا",
    email: "إيميل",
    whatsappNote: "بنرد في حوالي 10 دقايق",
    callNote: "من السبت للخميس، 10 الصبح لـ 10 بالليل",
    emailNote: "بنرد خلال 24 ساعة",
    send: "ابعتلنا رسالة",
  },
};
