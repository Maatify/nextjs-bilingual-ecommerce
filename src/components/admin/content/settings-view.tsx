"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { saveStoreSettings, type SettingsInput } from "@/app/admin/(panel)/settings/actions";
import { SecurityPanel } from "@/app/admin/(panel)/settings/security/security-panel";
import { cx } from "@/lib/format";
import { SOCIAL_NETWORKS } from "@/lib/social";
import type { Governorate } from "@/lib/types";
import { AIcon, type AIconName } from "../icons";
import { arProps, ArChip, Ltr, useT } from "../i18n";
import type { TFn } from "@/lib/i18n/admin";
import { Badge, Button, Card, Checkbox, ease, Field, Input, PageHeader, SaveBar, Switch, Tabs, Textarea, table, useDraft } from "../ui";
import { Counter, Panel, ProductSelect } from "./fields";
import type { ProductOption } from "./types";
import { useSaver } from "./use-saver";

export type SettingsTab = "store" | "shipping" | "payments" | "checkout" | "popups" | "security";

const TABS: { value: SettingsTab; icon: AIconName }[] = [
  { value: "store", icon: "store" },
  { value: "shipping", icon: "truck" },
  { value: "payments", icon: "card" },
  { value: "checkout", icon: "orders" },
  { value: "popups", icon: "bell" },
  { value: "security", icon: "lock" },
];

// activity-log names stay English (the log is a shared record)
const SECTION_NAMES: Record<keyof SettingsInput, string> = { site: "store details", governorates: "shipping rates", shipping: "default shipping", payments: "payments", checkout: "checkout", popups: "popups & widgets" };

/** Governorate display name in the dashboard language (stored names are English). */
export function govName(t: TFn, name: string) {
  const key = `content.govs.${name}` as Parameters<TFn>[0];
  const v = t(key);
  return v === key ? name : v;
}

export function SettingsView({ tab: initial, saved, products, cutoffHour, freeShippingAt }: { tab: SettingsTab; saved: SettingsInput; products: ProductOption[]; cutoffHour: number; freeShippingAt: number }) {
  const { t } = useT();
  const [tab, setTab] = useState(initial);
  const [draft, setDraft, dirty, reset] = useDraft(saved);
  const [save, saving] = useSaver(saveStoreSettings, t("content.settings.saved"));
  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // which tabs carry unsaved edits (dot on the tab)
  const changed = (Object.keys(saved) as (keyof SettingsInput)[]).filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(draft[k]));
  const tabOf: Record<keyof SettingsInput, SettingsTab> = { site: "store", governorates: "shipping", shipping: "shipping", payments: "payments", checkout: "checkout", popups: "popups" };
  const dirtyTabs = new Set(changed.map((k) => tabOf[k]));

  const go = (next: SettingsTab) => {
    setTab(next);
    // shallow URL update — no server round-trip, so unsaved edits on other tabs survive
    window.history.replaceState(null, "", `/admin/settings${next === "store" ? "" : `?tab=${next}`}`);
  };

  return (
    <>
      <PageHeader title={t("content.settings.title")} description={t("content.settings.description")} />

      <Tabs
        value={tab}
        onChange={go}
        className="mb-6"
        items={TABS.map((tb) => ({
          value: tb.value,
          label: (
            <span className="flex items-center gap-1.5">
              <AIcon name={tb.icon} size={14} className="opacity-70" />
              {t(`content.settings.tabs.${tb.value}`)}
              {dirtyTabs.has(tb.value) ? <span className="size-1.5 rounded-full bg-a-warn" aria-label={t("content.settings.unsaved")} /> : null}
            </span>
          ),
        }))}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease }}>
          {tab === "store" ? <StoreTab draft={draft} set={set} /> : null}
          {tab === "shipping" ? <ShippingTab draft={draft} set={set} cutoffHour={cutoffHour} freeShippingAt={freeShippingAt} /> : null}
          {tab === "payments" ? <PaymentsTab draft={draft} set={set} /> : null}
          {tab === "checkout" ? <CheckoutTab draft={draft} set={set} products={products} /> : null}
          {tab === "popups" ? <PopupsTab draft={draft} set={set} /> : null}
          {tab === "security" ? <SecurityTab /> : null}
        </motion.div>
      </AnimatePresence>

      <SaveBar dirty={dirty} saving={saving} onDiscard={reset} onSave={() => save(draft, changed.map((k) => SECTION_NAMES[k]))} label={changed.length > 1 ? t("content.settings.unsavedAreas", { count: changed.length }) : t("common.unsavedChanges")} />
    </>
  );
}

type TabProps = { draft: SettingsInput; set: <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => void };

/* ───────────── Store details ───────────── */

function StoreTab({ draft, set }: TabProps) {
  const { t } = useT();
  const s = draft.site;
  const up = (patch: Partial<typeof s>) => set("site", { ...s, ...patch });
  const wa = s.whatsapp.replace(/\D/g, "");
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card title={t("content.settings.identity")} description={t("content.settings.identityDesc")}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("content.settings.storeName")} htmlFor="st-name">
              <Input id="st-name" value={s.name} onChange={(e) => up({ name: e.target.value })} />
            </Field>
            <Field label={t("content.settings.legalName")} htmlFor="st-legal" hint={t("content.settings.legalHint")}>
              <Input id="st-legal" value={s.legalName} onChange={(e) => up({ legalName: e.target.value })} />
            </Field>
          </div>
          <Field label={t("content.settings.storeUrl")} htmlFor="st-url" hint={t("content.settings.storeUrlHint")}>
            <Input id="st-url" type="url" value={s.url} onChange={(e) => up({ url: e.target.value })} placeholder="https://verda.store" />
          </Field>
          <Field label={t("content.settings.descriptionLabel")} htmlFor="st-desc" aside={<Counter value={s.description} max={200} ideal={[110, 200]} />} hint={t("content.settings.descriptionHint")}>
            <Textarea id="st-desc" rows={3} value={s.description} onChange={(e) => up({ description: e.target.value })} />
          </Field>
          <Field
            label={
              <span className="flex items-center gap-2">
                {t("content.settings.descriptionAr")} <ArChip />
              </span>
            }
            htmlFor="st-desc-ar"
            aside={<Counter value={s.descriptionAr ?? ""} max={200} ideal={[110, 200]} />}
            hint={t("content.settings.descriptionArHint")}
          >
            <Textarea id="st-desc-ar" {...arProps} rows={3} value={s.descriptionAr ?? ""} onChange={(e) => up({ descriptionAr: e.target.value })} placeholder={s.description} />
          </Field>
          <Field label={t("content.settings.currency")} hint={t("content.settings.currencyHint")}>
            <div className="flex h-9 items-center gap-2 rounded-[10px] border border-a-line bg-a-panel-2/40 px-3 text-[13.5px] text-a-dim">
              <AIcon name="lock" size={13} />
              {s.currency} · {t("content.settings.egp")}
            </div>
          </Field>
        </div>
      </Card>

      <Card title={t("content.settings.contact")} description={t("content.settings.contactDesc")}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("content.settings.email")} htmlFor="st-email">
              <Input id="st-email" type="email" value={s.email} onChange={(e) => up({ email: e.target.value })} />
            </Field>
            <Field label={t("content.settings.phone")} htmlFor="st-phone">
              <Input id="st-phone" type="tel" value={s.phone} onChange={(e) => up({ phone: e.target.value })} />
            </Field>
          </div>
          <Field
            label={t("content.settings.whatsapp")}
            htmlFor="st-wa"
            hint={t("content.settings.whatsappHint")}
            error={wa && (wa.length < 10 || wa.length > 15) ? t("content.settings.whatsappErr") : null}
            aside={
              wa ? (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-a-ok transition hover:brightness-125">
                  <AIcon name="whatsapp" size={13} /> {t("content.settings.testWa")} <AIcon name="external" size={11} className="rtl:-scale-x-100" />
                </a>
              ) : null
            }
          >
            <div dir="ltr">
              <Input id="st-wa" inputMode="numeric" value={s.whatsapp} onChange={(e) => up({ whatsapp: e.target.value })} prefix="+" className="[&_input]:pl-7" />
            </div>
          </Field>
        </div>
      </Card>

      <Card title={t("content.settings.social")} description={t("content.settings.socialDesc")}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_NETWORKS.map((n) => (
              <Field key={n.key} label={n.label} htmlFor={`st-${n.key}`}>
                <div dir="ltr">
                  <Input id={`st-${n.key}`} type="url" value={s[n.key] ?? ""} onChange={(e) => up({ [n.key]: e.target.value })} placeholder={n.placeholder} />
                </div>
              </Field>
            ))}
          </div>
          <Switch checked={s.socialRail !== false} onChange={(v) => up({ socialRail: v })} label={t("content.settings.socialRail")} description={t("content.settings.socialRailDesc")} />
        </div>
      </Card>
    </div>
  );
}

/* ───────────── Shipping ───────────── */

function ShippingTab({ draft, set, cutoffHour, freeShippingAt }: TabProps & { cutoffHour: number; freeShippingAt: number }) {
  const { t, isRtl } = useT();
  const govs = draft.governorates;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkRate, setBulkRate] = useState("");
  const [q, setQ] = useState("");
  const list = useMemo(() => govs.filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase()) || govName(t, g.name).includes(q.trim())), [govs, q, t]);
  const up = (name: string, patch: Partial<Governorate>) => set("governorates", govs.map((g) => (g.name === name ? { ...g, ...patch } : g)));
  const allSel = list.length > 0 && list.every((g) => sel.has(g.name));
  const enabled = govs.filter((g) => g.enabled !== false).length;
  const rates = govs.filter((g) => g.enabled !== false).map((g) => g.rate);

  const toggleAll = (v: boolean) => setSel(v ? new Set(list.map((g) => g.name)) : new Set());
  const applyBulk = (patch: Partial<Governorate>) => {
    set("governorates", govs.map((g) => (sel.has(g.name) ? { ...g, ...patch } : g)));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title={t("content.settings.defaultFee")} description={t("content.settings.defaultFeeDesc")}>
          <div dir="ltr" className="max-w-[200px]">
            <Input aria-label={t("content.settings.defaultFee")} type="number" min={0} value={draft.shipping} onChange={(e) => set("shipping", Number(e.target.value))} prefix="EGP" />
          </div>
        </Card>
        <Card title={t("content.settings.thresholds")} description={t("content.settings.thresholdsDesc")}>
          <ul className="space-y-1.5 text-[13px] text-a-dim">
            <li className="flex justify-between gap-3">
              {t("content.settings.freeOver")} <b className="font-medium text-a-text"><Ltr>EGP {freeShippingAt.toLocaleString("en")}</Ltr></b>
            </li>
            <li className="flex justify-between gap-3">
              {t("content.settings.cutoff")} <b className="font-medium text-a-text"><Ltr>{String(cutoffHour).padStart(2, "0")}:00</Ltr></b>
            </li>
          </ul>
          <Link href="/admin/discounts" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-a-accent transition hover:text-a-text">
            {t("content.settings.editInDiscounts")} <AIcon name="chevronRight" size={14} className="rtl:-scale-x-100" />
          </Link>
        </Card>
      </div>

      <Card
        padded={false}
        title={t("content.settings.governorates")}
        description={
          <>
            {t("content.settings.governoratesDesc", { enabled, total: govs.length })}
            {rates.length ? (
              <>
                {" · "}
                <Ltr>
                  EGP {Math.min(...rates)}–{Math.max(...rates)}
                </Ltr>
              </>
            ) : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-a-line px-5 py-3">
          <Input aria-label={t("content.settings.searchGovs")} placeholder={t("content.settings.searchShort")} value={q} onChange={(e) => setQ(e.target.value)} prefix={<AIcon name="search" size={14} />} className="w-full sm:w-52 [&_input]:ps-9" />
          <AnimatePresence>
            {sel.size ? (
              <motion.div initial={{ opacity: 0, x: isRtl ? 6 : -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isRtl ? 6 : -6 }} transition={{ duration: 0.2, ease }} className="flex flex-wrap items-center gap-2">
                <Badge tone="violet">{t("common.selected", { count: sel.size })}</Badge>
                <div dir="ltr" className="w-[120px]">
                  <Input aria-label={t("content.settings.rateSelected")} type="number" min={0} placeholder={t("content.settings.rate")} value={bulkRate} onChange={(e) => setBulkRate(e.target.value)} prefix="EGP" />
                </div>
                <Button size="sm" disabled={bulkRate === ""} onClick={() => (applyBulk({ rate: Number(bulkRate) }), setBulkRate(""))}>
                  {t("content.settings.setRate")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => applyBulk({ enabled: true })}>
                  {t("content.settings.enable")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => applyBulk({ enabled: false })}>
                  {t("content.settings.disable")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
                  {t("common.clear")}
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className={cx(table.wrap, "max-h-[560px]")}>
          <table className={cx(table.table, "min-w-[620px]")}>
            <thead>
              <tr>
                <th className={cx(table.th, "w-10")}>
                  <Checkbox checked={allSel} onChange={toggleAll} label={<span className="sr-only">{t("content.settings.selectAll")}</span>} />
                </th>
                <th className={table.th}>{t("content.settings.governorate")}</th>
                <th className={table.th}>{t("content.settings.delivers")}</th>
                <th className={table.th}>{t("content.settings.rate")}</th>
                <th className={table.th}>{t("content.settings.deliveryDays")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => {
                const on = g.enabled !== false;
                return (
                  <tr key={g.name} className={cx(table.tr, sel.has(g.name) && "bg-a-violet/[0.06]")}>
                    <td className={table.td}>
                      <Checkbox
                        checked={sel.has(g.name)}
                        onChange={(v) =>
                          setSel((s) => {
                            const n = new Set(s);
                            if (v) n.add(g.name);
                            else n.delete(g.name);
                            return n;
                          })
                        }
                        label={<span className="sr-only">{t("content.settings.selectGov", { name: govName(t, g.name) })}</span>}
                      />
                    </td>
                    <td className={cx(table.td, "font-medium", !on && "text-a-faint")}>{govName(t, g.name)}</td>
                    <td className={table.td}>
                      <Switch checked={on} onChange={(v) => up(g.name, { enabled: v })} />
                    </td>
                    <td className={table.td}>
                      <div dir="ltr" className="w-[120px]">
                        <Input aria-label={t("content.settings.govRate", { name: govName(t, g.name) })} type="number" min={0} value={g.rate} disabled={!on} onChange={(e) => up(g.name, { rate: Number(e.target.value) })} prefix="EGP" />
                      </div>
                    </td>
                    <td className={table.td}>
                      <span className="flex items-center gap-1.5">
                        <Input aria-label={t("content.settings.govMin", { name: govName(t, g.name) })} type="number" min={0} max={30} value={g.days[0]} disabled={!on} onChange={(e) => up(g.name, { days: [Number(e.target.value), g.days[1]] })} className="w-16" />
                        <span className="text-a-faint">–</span>
                        <Input aria-label={t("content.settings.govMax", { name: govName(t, g.name) })} type="number" min={0} max={30} value={g.days[1]} disabled={!on} onChange={(e) => up(g.name, { days: [g.days[0], Number(e.target.value)] })} className="w-16" />
                        <span className="text-[12px] text-a-faint">{t("content.settings.days")}</span>
                        {g.days[0] > g.days[1] ? <AIcon name="alert" size={14} className="text-a-warn" aria-label={t("content.settings.minAboveMax")} /> : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-a-dim">
                    {t("content.settings.noGovMatch", { q })}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────── Payments ───────────── */

const PAYMENTS: { key: keyof SettingsInput["payments"]; icon: AIconName }[] = [
  { key: "cod", icon: "cash" },
  { key: "card", icon: "card" },
  { key: "wallet", icon: "phone" },
  { key: "installments", icon: "calendar" },
];

function PaymentsTab({ draft, set }: TabProps) {
  const { t } = useT();
  const p = draft.payments;
  const onCount = Object.values(p).filter(Boolean).length;
  return (
    <Card title={t("content.settings.paymentMethods")} description={t("content.settings.paymentMethodsDesc")}>
      <ul className="divide-y divide-a-line/70">
        {PAYMENTS.map((m) => {
          const last = p[m.key] && onCount === 1;
          const desc = t(`content.settings.pay.${m.key}.desc`);
          return (
            <li key={m.key} className="flex items-start gap-3.5 py-4 first:pt-1 last:pb-1">
              <span className={cx("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border transition-colors", p[m.key] ? "border-a-violet/40 bg-a-violet/12 text-a-accent" : "border-a-line bg-a-panel-2 text-a-faint")}>
                <AIcon name={m.icon} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <Switch checked={p[m.key]} disabled={last} onChange={(v) => set("payments", { ...p, [m.key]: v })} label={t(`content.settings.pay.${m.key}.label`)} description={last ? t("content.settings.onlyMethod", { desc }) : desc} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ───────────── Checkout ───────────── */

function CheckoutTab({ draft, set, products }: TabProps & { products: ProductOption[] }) {
  const { t } = useT();
  const c = draft.checkout;
  const up = (patch: Partial<typeof c>) => set("checkout", { ...c, ...patch });
  const bump = products.find((p) => p.id === c.orderBumpProductId);
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card title={t("content.settings.deliveryOptions")}>
        <div className="space-y-5">
          <Switch checked={c.protectionEnabled} onChange={(v) => up({ protectionEnabled: v })} label={t("content.settings.protection")} description={t("content.settings.protectionDesc")} />
          <div className="h-px bg-a-line" />
          <Switch checked={c.expressEnabled} onChange={(v) => up({ expressEnabled: v })} label={t("content.settings.express")} description={t("content.settings.expressDesc")} />
          <AnimatePresence initial={false}>
            {c.expressEnabled ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                <Field label={t("content.settings.expressFee")} htmlFor="co-exp" className="pt-1">
                  <div dir="ltr" className="max-w-[180px]">
                    <Input id="co-exp" type="number" min={0} value={c.expressFee} onChange={(e) => up({ expressFee: Number(e.target.value) })} prefix="EGP" />
                  </div>
                </Field>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </Card>

      <Panel title={t("content.settings.bump")} description={t("content.settings.bumpDesc")}>
        <div className="space-y-4">
          <Switch checked={c.orderBumpEnabled} onChange={(v) => up({ orderBumpEnabled: v })} label={t("content.settings.showBump")} description={t("content.settings.showBumpDesc")} />
          <div className={cx("space-y-4 transition-opacity", !c.orderBumpEnabled && "pointer-events-none opacity-40")} aria-disabled={!c.orderBumpEnabled}>
            <Field label={t("content.settings.product")}>
              <ProductSelect value={c.orderBumpProductId} onChange={(id) => up({ orderBumpProductId: id })} products={products} />
            </Field>
            {bump ? (
              <div className="rounded-xl bg-[#ecede8] p-3 text-[#101310]" aria-label={t("content.settings.bumpPreview")}>
                <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-[#1d3a2a]/40 bg-white p-2.5">
                  <span className="grid size-5 place-items-center rounded bg-[#1d3a2a] text-white">
                    <AIcon name="check" size={12} strokeWidth={2.6} />
                  </span>
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-[#f1f1ee]">{bump.image ? <Image src={bump.image} alt="" fill sizes="44px" className="object-cover" /> : null}</span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[12.5px] font-semibold">{t("content.settings.bumpAdd", { name: bump.title })}</span>
                    <span className="block text-[11.5px] text-[#5f645d]">{t("content.settings.bumpLine")}</span>
                  </span>
                  <bdi dir="ltr" className="text-[12.5px] font-semibold tabular-nums">EGP {bump.price.toLocaleString("en")}</bdi>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ───────────── Popups & widgets ───────────── */

function PopupsTab({ draft, set }: TabProps) {
  const { t } = useT();
  const p = draft.popups;
  const up = (patch: Partial<typeof p>) => set("popups", { ...p, ...patch });
  return (
    <Card title={t("content.settings.popups")} description={t("content.settings.popupsDesc")}>
      <ul className="divide-y divide-a-line/70">
        <li className="pb-4">
          <Switch checked={p.welcome} onChange={(v) => up({ welcome: v })} label={t("content.settings.welcome")} description={t("content.settings.welcomeDesc")} />
          <AnimatePresence initial={false}>
            {p.welcome ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                <Field label={t("content.settings.delay")} htmlFor="pp-delay" hint={t("content.settings.delayHint")} className="max-w-[260px] pt-3">
                  <div dir="ltr">
                    <Input id="pp-delay" type="number" min={0} max={600} value={p.welcomeDelaySec} onChange={(e) => up({ welcomeDelaySec: Number(e.target.value) })} suffix={t("content.settings.sec")} />
                  </div>
                </Field>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </li>
        <li className="py-4">
          <Switch checked={p.socialProof} onChange={(v) => up({ socialProof: v })} label={t("content.settings.socialProof")} description={t("content.settings.socialProofDesc")} />
        </li>
        <li className="pt-4">
          <Switch checked={p.whatsapp} onChange={(v) => up({ whatsapp: v })} label={t("content.settings.waButton")} description={draft.site.whatsapp ? t("content.settings.waButtonDesc", { number: `\u2066+${draft.site.whatsapp.replace(/\D/g, "")}\u2069` }) : t("content.settings.waButtonNeed")} />
        </li>
      </ul>
    </Card>
  );
}

/* ───────────── Security ───────────── */

// password, two-factor and sessions live in their own panel (loads its own data via server actions)
function SecurityTab() {
  return <SecurityPanel />;
}
