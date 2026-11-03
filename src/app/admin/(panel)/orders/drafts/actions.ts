"use server";

import { revalidatePath } from "next/cache";
import { applyOffers, discountAmount, draftTotals, offerRules, type DraftInput } from "@/components/admin/sales/draft-types";
import { normalizeEgPhone } from "@/lib/egypt";
import { variantPrice, variantStock } from "@/lib/variants";
import { getT } from "@/lib/i18n/admin/server";
import type { TFn } from "@/lib/i18n/admin";
import { money } from "@/lib/format";
import type { Order, OrderLine } from "@/lib/types";
import { fail, guard, published, type ActionResult } from "@/server/admin";
import { decrementStock, deleteOrder, getDb, getOrder, getProduct, getSettings, logActivity, saveOrder, saveSettings, withTx } from "@/server/store";

const METHODS: Order["paymentMethod"][] = ["cod", "card", "wallet", "installments"];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const s = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const stamp = () => new Date().toISOString();

function nextDraftNumber() {
  const rows = getDb().prepare("SELECT number FROM orders WHERE number LIKE 'D-%'").all() as { number: string }[];
  const max = rows.reduce((m, r) => Math.max(m, Number(r.number.slice(2)) || 0), 1000);
  return `D-${max + 1}`;
}
function newOrderNumber() {
  for (let i = 0; i < 20; i++) {
    const number = `VD-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!getOrder(number)) return number;
  }
  return `VD-${Date.now().toString().slice(-8)}`;
}

/** Validate + price an editor payload. `strict` = placing a real order (customer, address, stock required). */
function build(t: TFn, input: DraftInput, strict: boolean): { lines: OrderLine[]; customer: Order["customer"]; address: Order["address"]; totals: Order["totals"]; promoCode?: string; paymentMethod: Order["paymentMethod"]; notes: string } {
  if (!input || typeof input !== "object" || !Array.isArray(input.lines)) throw new Error(t("sales.errors.invalidOrder"));
  if (!input.lines.length) throw new Error(t("sales.errors.addProduct"));
  if (input.lines.length > 100) throw new Error(t("sales.errors.tooManyLines"));
  const lines: OrderLine[] = [];
  const need = new Map<string, number>();
  for (const raw of input.lines) {
    if (!raw || typeof raw !== "object" || typeof raw.productId !== "string" || !ID.test(raw.productId)) throw new Error(t("sales.errors.invalidProduct"));
    const p = getProduct(raw.productId);
    if (!p) throw new Error(t("sales.errors.productGone"));
    const color = p.colors.find((c) => c.name === raw.color);
    if (!color) throw new Error(t("sales.errors.chooseColour", { title: p.title }));
    if (!p.sizes.some((x) => x.label === raw.size)) throw new Error(t("sales.errors.chooseSize", { title: p.title }));
    const qty = Math.floor(Number(raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 999) throw new Error(t("sales.errors.invalidQty", { title: p.title }));
    const unit = variantPrice(p, color.name, raw.size).price;
    const k = `${p.id}|${color.name}|${raw.size}`;
    need.set(k, (need.get(k) ?? 0) + qty);
    lines.push({ productId: p.id, handle: p.handle, title: p.title, color: color.name, size: raw.size, qty, unit, image: color.images[0] ?? "", total: unit * qty, free: 0 });
  }
  if (strict)
    for (const [k, qty] of need) {
      const [id, color, size] = k.split("|");
      const p = getProduct(id)!;
      const left = variantStock(p, color, size);
      if (left < qty) throw new Error(left ? t("sales.errors.onlyLeft", { count: left, title: p.title, variant: `${color} / ${size}` }) : t("sales.errors.outOfStock", { title: p.title, variant: `${color} / ${size}` }));
    }

  const c = input.customer ?? { name: "", phone: "" };
  const name = s(c.name, 120);
  const rawPhone = s(c.phone, 30);
  const phone = normalizeEgPhone(rawPhone);
  const email = s(c.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(t("sales.errors.emailInvalid"));
  if (rawPhone && !phone) throw new Error(t("sales.errors.egPhone"));
  if (strict && !name) throw new Error(t("sales.errors.addName"));
  if (strict && !phone) throw new Error(t("sales.errors.addPhone"));

  const a = input.address ?? { governorate: "", city: "", street: "", building: "" };
  const settings = getSettings();
  const gov = settings.governorates.find((g) => g.name === s(a.governorate, 60));
  if (a.governorate && !gov) throw new Error(t("sales.errors.govFromList"));
  const address: Order["address"] = { governorate: gov?.name ?? "", city: s(a.city, 120), street: s(a.street, 200), building: s(a.building, 160), landmark: s(a.landmark, 160) || undefined, notes: undefined };
  if (strict && (!address.governorate || !address.city || !address.street)) throw new Error(t("sales.errors.addressRequired"));

  const notes = s(input.notes, 1000);
  address.notes = notes || undefined;
  const fee = Number(input.shippingFee);
  const shipping = Number.isFinite(fee) ? Math.min(100_000, Math.max(0, fee)) : (gov?.rate ?? settings.offer.shipping);
  // automatic offers (Buy N Get M + multi-buy %), same rules as the storefront checkout
  const offers = applyOffers(lines, offerRules(settings.offer));
  lines.forEach((l, i) => {
    l.free = offers.free[i];
    l.total = l.unit * (l.qty - l.free) - offers.off[i];
  });
  const merch = lines.reduce((n, l) => n + l.unit * l.qty, 0) - offers.bogo - offers.multi;
  const d = input.discount ?? { kind: "none" };
  if (!["none", "code", "amount", "pct"].includes(d.kind)) throw new Error(t("sales.errors.invalidDiscount"));
  const disc = discountAmount({ kind: d.kind, value: Number(d.value) || 0, code: s(d.code, 40) }, merch, settings.promoCodes);
  if (d.kind === "code" && disc.error) throw new Error(t("sales.errors.discountCode", { error: t(`sales.draft.codeErr.${disc.error}`, { min: money(disc.min ?? 0) }) }));
  const tot = draftTotals(lines, disc.amount, shipping, offers);
  const paymentMethod = METHODS.includes(input.paymentMethod) ? input.paymentMethod : "cod";
  return {
    lines,
    customer: { name, phone: phone ?? "", email: email || undefined },
    address,
    totals: { itemCount: lines.reduce((n, l) => n + l.qty, 0), subtotal: tot.subtotal, bogoDiscount: tot.bogo, multiDiscount: tot.multi, promoDiscount: tot.discount, prepaidDiscount: 0, shipping: tot.shipping, protection: 0, bump: 0, total: tot.total },
    promoCode: disc.code,
    paymentMethod,
    notes,
  };
}

function loadDraft(t: TFn, id: string) {
  if (typeof id !== "string" || !ID.test(id)) throw new Error(t("sales.errors.invalidDraft"));
  const o = getOrder(id);
  if (!o || o.status !== "draft") throw new Error(t("sales.errors.draftNotFound"));
  return o;
}

/** Save (create or update) a draft. Drafts never touch stock or stats. */
export async function saveDraftOrder(input: DraftInput, id?: string): Promise<ActionResult<{ id: string; number: string }>> {
  await guard();
  const { t } = await getT();
  try {
    const b = build(t, input, false);
    const prev = id ? loadDraft(t, id) : null;
    const at = stamp();
    const number = prev?.number ?? nextDraftNumber();
    const o: Order = {
      id: prev?.id ?? `d_${number}`,
      number,
      createdAt: prev?.createdAt ?? at,
      status: "draft",
      paymentStatus: "unpaid",
      paymentMethod: b.paymentMethod,
      source: "manual",
      customer: b.customer,
      address: b.address,
      shipping: "standard",
      lines: b.lines,
      totals: b.totals,
      promoCode: b.promoCode,
      timeline: [...(prev?.timeline ?? [{ status: "draft" as const, at, by: "admin" }]), ...(prev ? [{ status: "note" as const, at, by: "admin", note: "Draft edited" }] : [])].slice(-50),
    };
    saveOrder(o);
    published(prev ? "Updated draft order" : "Created draft order", number);
    return { ok: true, data: { id: o.id, number } };
  } catch (e) {
    return fail(e);
  }
}

/** Place a real order from the editor (optionally converting an existing draft). Decrements stock per variant. */
export async function createOrder(input: DraftInput, draftId?: string, requestId?: string): Promise<ActionResult<{ id: string; number: string }>> {
  await guard();
  const { t } = await getT();
  try {
    // validate → stock check → save → decrement → drop draft → promo usage → log, all in ONE write transaction:
    // a double-clicked "Create order" (or two tabs converting the same draft) can't create two orders or
    // decrement twice — the second call finds the draft gone / the stock already taken and fails cleanly.
    const key = typeof requestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(requestId) ? requestId : undefined;
    const o = withTx(() => {
      // idempotent: the same editor submit arriving twice returns the order the first one placed
      if (key) {
        const hit = getDb().prepare("SELECT data FROM orders WHERE json_extract(data, '$.requestId') = ?").get(key) as { data: string } | undefined;
        if (hit) return JSON.parse(hit.data) as Order;
      }
      const draft = draftId ? loadDraft(t, draftId) : null;
      const b = build(t, input, true);
      const at = stamp();
      const number = newOrderNumber();
      const o: Order = {
        id: `o_${number}`,
        number,
        createdAt: at,
        status: "pending",
        paymentStatus: "unpaid",
        paymentMethod: b.paymentMethod,
        source: "manual",
        customer: { ...b.customer, whatsappUpdates: true },
        address: b.address,
        shipping: "standard",
        lines: b.lines,
        totals: b.totals,
        promoCode: b.promoCode,
        timeline: [{ status: "pending", at, by: "admin", note: draft ? `Created from draft ${draft.number}` : "Created in admin" }],
        requestId: key,
      };
      saveOrder(o);
      decrementStock(b.lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })));
      if (draft) deleteOrder(draft.id);
      if (o.promoCode) {
        const st = getSettings();
        saveSettings({ ...st, promoCodes: st.promoCodes.map((c) => (c.code.toUpperCase() === o.promoCode ? { ...c, used: (c.used ?? 0) + 1 } : c)) });
      }
      logActivity("Created order", number, `${draft ? `From draft ${draft.number} · ` : ""}EGP ${o.totals.total.toLocaleString("en")}`);
      return o;
    });
    revalidatePath("/", "layout");
    const { id, number } = o;
    return { ok: true, data: { id, number } };
  } catch (e) {
    return fail(e);
  }
}

/** Convert a saved draft as-is (from the drafts list). */
export async function convertDraft(id: string): Promise<ActionResult<{ id: string; number: string }>> {
  await guard();
  const { t } = await getT();
  try {
    const d = loadDraft(t, id);
    const input: DraftInput = {
      lines: d.lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })),
      customer: { name: d.customer.name, phone: d.customer.phone, email: d.customer.email },
      address: { governorate: d.address.governorate, city: d.address.city, street: d.address.street, building: d.address.building, landmark: d.address.landmark },
      shippingFee: d.totals.shipping,
      discount: d.promoCode ? { kind: "code", code: d.promoCode } : d.totals.promoDiscount ? { kind: "amount", value: d.totals.promoDiscount } : { kind: "none" },
      notes: d.address.notes ?? "",
      paymentMethod: d.paymentMethod,
    };
    return await createOrder(input, id);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDrafts(ids: string[]): Promise<ActionResult<number>> {
  await guard();
  try {
    if (!Array.isArray(ids) || ids.length > 500 || ids.some((id) => typeof id !== "string" || !ID.test(id))) return { ok: false, error: (await getT()).t("sales.errors.invalidSelectionShort") };
    let n = 0;
    for (const id of ids) {
      const o = getOrder(id);
      if (o?.status === "draft") (deleteOrder(id), n++);
    }
    published(`Deleted ${n} draft order${n === 1 ? "" : "s"}`);
    revalidatePath("/admin/orders/drafts");
    return { ok: true, data: n };
  } catch (e) {
    return fail(e);
  }
}
