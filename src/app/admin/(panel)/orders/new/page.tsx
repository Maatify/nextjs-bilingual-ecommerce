import type { Metadata } from "next";
import { getT } from "@/lib/i18n/admin/server";
import { notFound } from "next/navigation";
import { DraftOrderEditor } from "@/components/admin/sales/draft-order-editor";
import { offerRules } from "@/components/admin/sales/draft-types";
import type { DraftInput, PickerCustomer, PickerProduct } from "@/components/admin/sales/draft-types";
import { isTracked, variantPrice, variantStock } from "@/lib/variants";
import { normPhone, placedOrders } from "@/server/queries/sales";
import { getOrder, getSettings, listProducts } from "@/server/store";
import { requireAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("sales.draft.metaTitle") };
}

function pickerProducts(): PickerProduct[] {
  return listProducts()
    .filter((p) => (p.status ?? "active") !== "archived")
    .map((p) => {
      const stock: PickerProduct["stock"] = {};
      const prices: PickerProduct["prices"] = {};
      for (const c of p.colors) {
        stock[c.name] = {};
        for (const s of p.sizes) {
          stock[c.name][s.label] = variantStock(p, c.name, s.label);
          const vp = variantPrice(p, c.name, s.label).price;
          if (vp !== p.price) prices[`${c.name}|${s.label}`] = vp;
        }
      }
      return { id: p.id, title: p.title, status: p.status ?? "active", price: p.price, colors: p.colors.map((c) => ({ name: c.name, hex: c.hex, image: c.images[0] ?? "" })), sizes: p.sizes.map((s) => s.label), stock, prices, tracked: isTracked(p) };
    });
}

function pickerCustomers(): PickerCustomer[] {
  const map = new Map<string, PickerCustomer>();
  for (const o of placedOrders()) {
    const k = normPhone(o.customer.phone);
    if (!k) continue;
    const e = map.get(k);
    if (e) e.orders++;
    else map.set(k, { name: o.customer.name, phone: o.customer.phone, email: o.customer.email, orders: 1, address: { governorate: o.address.governorate, city: o.address.city, street: o.address.street, building: o.address.building, landmark: o.address.landmark } });
  }
  return [...map.values()];
}

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  const sp = await searchParams;
  const draftId = typeof sp.draft === "string" ? sp.draft : undefined;
  const draft = draftId ? getOrder(draftId) : null;
  if (draftId && (!draft || draft.status !== "draft")) notFound();
  const settings = getSettings();
  const initial: DraftInput | null = draft
    ? {
        lines: draft.lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })),
        customer: { name: draft.customer.name, phone: draft.customer.phone, email: draft.customer.email },
        address: { governorate: draft.address.governorate, city: draft.address.city, street: draft.address.street, building: draft.address.building, landmark: draft.address.landmark },
        shippingFee: draft.totals.shipping,
        discount: draft.promoCode ? { kind: "code", code: draft.promoCode } : draft.totals.promoDiscount ? { kind: "amount", value: draft.totals.promoDiscount } : { kind: "none" },
        notes: draft.address.notes ?? "",
        paymentMethod: draft.paymentMethod,
      }
    : null;
  return (
    <DraftOrderEditor
      key={draft?.id ?? "new"}
      draft={draft ? { id: draft.id, number: draft.number, createdAt: draft.createdAt } : null}
      initial={initial}
      products={pickerProducts()}
      customers={pickerCustomers()}
      governorates={settings.governorates.filter((g) => g.enabled !== false).map((g) => ({ name: g.name, rate: g.rate }))}
      defaultShipping={settings.offer.shipping}
      codes={settings.promoCodes.map((c) => ({ code: c.code, label: c.label, pct: c.pct, amount: c.amount, minSubtotal: c.minSubtotal, active: c.active }))}
      payments={settings.payments}
      offer={offerRules(settings.offer)}
    />
  );
}
