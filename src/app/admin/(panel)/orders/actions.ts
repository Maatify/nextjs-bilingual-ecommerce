"use server";

import { canAdvance, canCancel, canReturn, FLOW, STATUS_META } from "@/components/admin/sales/meta";
import { getT } from "@/lib/i18n/admin/server";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import { fail, guard, type ActionResult } from "@/server/admin";
import { revalidatePath } from "next/cache";
import { restoreStock } from "@/server/queries/sales";
import { getOrder, logActivity, saveOrder, withTx } from "@/server/store";

const stamp = () => new Date().toISOString();
const STATUSES = Object.keys(STATUS_META) as OrderStatus[];

/**
 * Read-modify-write one order inside a single write transaction, so an edit (note, tags, payment, details) can never
 * write back a stale copy over a concurrent status change — that used to be able to revert a cancel (and drop
 * `stockRestoredAt`), letting the order be cancelled and restocked a second time.
 */
function patchOrder(id: string, notFound: string, action: string, mutate: (o: Order) => void) {
  withTx(() => {
    const o = typeof id === "string" ? getOrder(id) : null;
    if (!o) throw new Error(notFound);
    mutate(o);
    saveOrder(o);
    logActivity(action, o.number);
  });
  revalidatePath("/", "layout");
}

/** Statuses whose units are out of stock (decremented when the order was placed). Drafts never touched stock. */
const HOLDS_STOCK: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"];

/**
 * Apply a status change in place; returns false when the move isn't allowed. Must run inside withTx() on an
 * order read in that same transaction. Stock goes back exactly once: only on a real transition out of a
 * stock-holding status, and `stockRestoredAt` makes a second cancel/return (double-click, two tabs, bulk + detail)
 * a no-op for stock. There is no way back out of cancelled/returned (canAdvance), so nothing re-decrements.
 */
function transition(o: Order, to: OrderStatus, note?: string): boolean {
  const at = stamp();
  if (FLOW.includes(to)) {
    if (!canAdvance(o.status, to)) return false;
    // record every step we jump through so the stepper has a timestamp for each
    for (const s of FLOW.slice(FLOW.indexOf(o.status) + 1, FLOW.indexOf(to) + 1)) o.timeline.push({ status: s, at, by: "admin" });
    if (to === "delivered" && o.paymentMethod === "cod" && o.paymentStatus === "unpaid") o.paymentStatus = "paid";
  } else if (to === "cancelled" || to === "returned") {
    if (to === "cancelled" ? !canCancel(o.status) : !canReturn(o.status)) return false;
    if (HOLDS_STOCK.includes(o.status) && !o.stockRestoredAt) {
      restoreStock(o.lines);
      o.stockRestoredAt = at;
    }
    o.timeline.push({ status: to, at, by: "admin", note });
  } else return false;
  o.status = to;
  return true;
}

const refreshStore = () => revalidatePath("/", "layout");

export async function setOrderStatus(id: string, to: OrderStatus, note?: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (!STATUSES.includes(to)) return { ok: false, error: t("sales.errors.invalidStatus") };
    if (note !== undefined && typeof note !== "string") return { ok: false, error: t("sales.errors.invalidNote") };
    if (typeof id !== "string") return { ok: false, error: t("sales.errors.orderNotFound") };
    // read → transition → restock → save → log, all in ONE write transaction: a concurrent double-submit or a
    // stale page sees the committed status and is rejected instead of restocking twice
    const res = withTx(() => {
      const o = getOrder(id);
      if (!o) throw new Error(t("sales.errors.orderNotFound"));
      if (!transition(o, to, note?.trim().slice(0, 500) || undefined)) return { ok: false as const, error: t("sales.errors.cantMove", { from: t(`sales.status.${o.status}`), to: t(`sales.status.${to}`) }) };
      saveOrder(o);
      logActivity(`Order ${STATUS_META[to].label.toLowerCase()}`, o.number);
      return { ok: true as const };
    });
    if (res.ok) refreshStore();
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function advanceOrders(ids: string[], to: OrderStatus): Promise<ActionResult<{ updated: number; skipped: number }>> {
  await guard();
  const { t } = await getT();
  try {
    if (!FLOW.includes(to)) return { ok: false, error: t("sales.errors.bulkForward") };
    if (!Array.isArray(ids)) return { ok: false, error: t("sales.errors.invalidSelection") };
    const { updated, skipped } = withTx(() => {
      let updated = 0;
      let skipped = 0;
      for (const id of ids.slice(0, 500)) {
        const o = typeof id === "string" ? getOrder(id) : null;
        if (o && transition(o, to)) {
          saveOrder(o);
          updated++;
        } else skipped++;
      }
      if (updated) logActivity(`Bulk: ${updated} orders → ${STATUS_META[to].label.toLowerCase()}`, undefined, skipped ? `${skipped} skipped` : undefined);
      return { updated, skipped };
    });
    if (updated) refreshStore();
    return { ok: true, data: { updated, skipped } };
  } catch (e) {
    return fail(e);
  }
}

export async function setPaymentStatus(id: string, status: PaymentStatus): Promise<ActionResult> {
  await guard();
  try {
    const { t } = await getT();
    if (!["unpaid", "paid", "refunded"].includes(status)) return { ok: false, error: t("sales.errors.invalidPayment") };
    patchOrder(id, t("sales.errors.orderNotFound"), `Payment ${status}`, (o) => {
      o.paymentStatus = status;
      o.timeline.push({ status: "note", at: stamp(), by: "admin", note: `Payment marked ${status}` });
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addOrderNote(id: string, note: string): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    if (typeof note !== "string") return { ok: false, error: t("sales.errors.writeNote") };
    const text = note.trim().slice(0, 1000);
    if (!text) return { ok: false, error: t("sales.errors.writeNote") };
    patchOrder(id, t("sales.errors.orderNotFound"), "Added order note", (o) => {
      o.timeline.push({ status: "note", at: stamp(), by: "admin", note: text });
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export interface OrderDetailsInput {
  customer: Order["customer"];
  address: Order["address"];
  shipping: Order["shipping"];
}

export async function updateOrderDetails(id: string, input: OrderDetailsInput): Promise<ActionResult> {
  await guard();
  const { t } = await getT();
  try {
    const s = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const name = s(input.customer.name, 120);
    const phone = s(input.customer.phone, 20);
    if (!name) return { ok: false, error: t("sales.errors.nameRequired") };
    if (!/^\+?[0-9 ]{8,16}$/.test(phone)) return { ok: false, error: t("sales.errors.phoneInvalid") };
    const email = s(input.customer.email, 160);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: t("sales.errors.emailInvalid") };
    if (!s(input.address.governorate) || !s(input.address.city) || !s(input.address.street)) return { ok: false, error: t("sales.errors.addressRequired") };
    const address: Order["address"] = {
      governorate: s(input.address.governorate),
      city: s(input.address.city),
      street: s(input.address.street),
      building: s(input.address.building),
      landmark: s(input.address.landmark) || undefined,
      notes: s(input.address.notes, 500) || undefined,
    };
    patchOrder(id, t("sales.errors.orderNotFound"), "Edited order details", (o) => {
      o.customer = { ...o.customer, name, phone, email: email || undefined };
      o.address = address;
      o.shipping = input.shipping === "express" ? "express" : "standard";
      o.timeline.push({ status: "note", at: stamp(), by: "admin", note: "Customer / shipping details edited" });
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setOrderTags(id: string, tags: string[]): Promise<ActionResult> {
  await guard();
  try {
    const { t } = await getT();
    if (!Array.isArray(tags) || tags.length > 100 || tags.some((x) => typeof x !== "string")) return { ok: false, error: t("sales.errors.invalidTags") };
    const clean = [...new Set(tags.map((x) => x.trim().toLowerCase().slice(0, 32)).filter(Boolean))].slice(0, 20);
    patchOrder(id, t("sales.errors.orderNotFound"), "Updated order tags", (o) => {
      o.tags = clean;
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
