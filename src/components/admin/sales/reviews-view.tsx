"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";
import { createReview, deleteReviews, saveReviewReply, setReviewsStatus, type NewReviewInput } from "@/app/admin/(panel)/reviews/actions";
import { cx } from "@/lib/format";
import type { StoredReview } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Badge, Button, Card, Checkbox, ConfirmButton, Drawer, EmptyState, Field, IconBtn, Input, PageHeader, Select, Stat, Switch, Tabs, Textarea, ease, toast, type Tone } from "../ui";
import { Stars, Thumb, DemoBadge } from "./bits";
import { AdminReviewPhotos, ImportDrawer, RequestsPanel, RewardChip, sourceKey, type RequestRow } from "./reviews-collect";

type Status = StoredReview["status"];
type TabV = Status | "all";
type ProductLite = { id: string; title: string; image: string; sizes: string[] };

const STATUS_TONE: Record<Status, { tone: Tone }> = {
  published: { tone: "green" },
  pending: { tone: "amber" },
  hidden: { tone: "neutral" },
};
const PAGE = 20;

export function ReviewsView({ reviews, products, today, requests, requestPrompt }: { reviews: StoredReview[]; products: ProductLite[]; today: string; requests: RequestRow[]; requestPrompt: boolean }) {
  const router = useRouter();
  const { t } = useT();
  const [tab, setTab] = useState<TabV>(() => (reviews.some((r) => r.status === "pending") ? "pending" : "all"));
  const [q, setQ] = useState("");
  const [product, setProduct] = useState("all");
  const [rating, setRating] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const dq = useDeferredValue(q.trim().toLowerCase());
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(
    () =>
      reviews.filter(
        (r) =>
          (product === "all" || r.productId === product) &&
          (rating === "all" || (rating === "low" ? r.rating <= 3 : r.rating === Number(rating))) &&
          (!dq || `${r.author} ${r.city} ${r.title} ${r.body} ${r.reply ?? ""} ${r.rewardCode ?? ""}`.toLowerCase().includes(dq)),
      ),
    [reviews, product, rating, dq],
  );
  const counts = useMemo(() => ({ all: filtered.length, published: filtered.filter((r) => r.status === "published").length, pending: filtered.filter((r) => r.status === "pending").length, hidden: filtered.filter((r) => r.status === "hidden").length }), [filtered]);
  const rows = useMemo(() => (tab === "all" ? filtered : filtered.filter((r) => r.status === tab)), [filtered, tab]);
  const shown = rows.slice(0, limit);

  const published = reviews.filter((r) => r.status === "published");
  const avg = published.length ? published.reduce((n, r) => n + r.rating, 0) / published.length : 0;

  const reset = () => {
    setLimit(PAGE);
    setSelected(new Set());
  };
  const after = () => {
    setSelected(new Set());
    router.refresh();
  };

  const setStatus = async (ids: string[], status: Status, key: string) => {
    setBusy(key);
    const res = await setReviewsStatus(ids, status);
    setBusy(null);
    if (!res.ok) return toast.error(t("sales.reviews.updateFail"), res.error);
    toast.success(t(`sales.reviews.done.${status}`, { count: res.data?.updated ?? 0 }), status === "published" ? t("sales.reviews.nowVisible") : undefined);
    for (const code of res.data?.rewards ?? []) toast.success(t("reviews.reward.issued", { code }), t("reviews.reward.issuedBody"));
    after();
  };
  const remove = async (ids: string[]) => {
    const res = await deleteReviews(ids);
    if (!res.ok) return toast.error(t("sales.drafts.deleteFail"), res.error);
    toast.success(t("sales.reviews.deleted", { count: ids.length }));
    after();
  };

  const allShown = shown.length > 0 && shown.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader
        title={t("sales.reviews.title")}
        description={t("sales.reviews.description")}
        actions={
          <>
            <Button icon="upload" onClick={() => setImporting(true)}>
              {t("reviews.import.button")}
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
              {t("sales.reviews.add")}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("sales.reviews.avg")} value={avg} format={(n) => n.toFixed(2)} icon="reviews" tone="#f5b545" hint={t("sales.reviews.publishedCount", { count: published.length })} />
        <Stat label={t("sales.reviews.status.pending")} value={reviews.filter((r) => r.status === "pending").length} icon="bell" tone="#f5b545" hint={t("sales.reviews.waiting")} />
        <Stat label={t("sales.reviews.withPhotos")} value={reviews.filter((r) => r.photo || r.photos?.length).length} icon="media" tone="#f472b6" />
        <Stat label={t("sales.reviews.replied")} value={reviews.filter((r) => r.reply).length} icon="mail" tone="#5ee0a0" />
      </div>

      <RequestsPanel rows={requests} prompt={requestPrompt} />

      <div className="mb-4 flex flex-col gap-3">
        <Tabs<TabV>
          value={tab}
          onChange={(v) => {
            setTab(v);
            reset();
          }}
          items={[
            { value: "all", label: t("common.all"), count: counts.all },
            { value: "published", label: t("sales.reviews.status.published"), count: counts.published },
            { value: "pending", label: t("sales.reviews.status.pending"), count: counts.pending },
            { value: "hidden", label: t("sales.reviews.status.hidden"), count: counts.hidden },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
            <Input value={q} onChange={(e) => (setQ(e.target.value), reset())} placeholder={t("sales.reviews.searchPh")} aria-label={t("sales.reviews.searchAria")} className="ps-9" />
          </div>
          <Select value={product} onChange={(e) => (setProduct(e.target.value), reset())} aria-label={t("sales.reviews.byProduct")} className="sm:w-56">
            <option value="all">{t("sales.reviews.allProducts")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <Select value={rating} onChange={(e) => (setRating(e.target.value), reset())} aria-label={t("sales.reviews.byRating")} className="sm:w-40">
            <option value="all">{t("sales.reviews.anyRating")}</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {t("sales.reviews.nStars", { count: n })}
              </option>
            ))}
            <option value="low">{t("sales.reviews.low")}</option>
          </Select>
        </div>
      </div>

      <Card padded={false}>
        {shown.length ? (
          <>
            <div className="flex items-center justify-between border-b border-a-line px-5 py-2.5">
              <Checkbox checked={allShown} onChange={(v) => setSelected(v ? new Set(shown.map((r) => r.id)) : new Set())} label={<span className="text-[12.5px] text-a-dim">{t("sales.reviews.selectShown")}</span>} />
              <span className="text-[12.5px] tabular-nums text-a-faint">
                {t("sales.reviews.shownOf", { shown: shown.length, total: rows.length })}
              </span>
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {shown.map((r, i) => (
                  <ReviewItem
                    key={r.id}
                    r={r}
                    index={i}
                    product={byId.get(r.productId)}
                    selected={selected.has(r.id)}
                    onSelect={() => toggle(r.id)}
                    busy={busy}
                    onStatus={(s) => setStatus([r.id], s, `${r.id}:${s}`)}
                    onDelete={() => remove([r.id])}
                    onReplied={after}
                  />
                ))}
              </AnimatePresence>
            </ul>
            {rows.length > limit ? (
              <div className="border-t border-a-line px-5 py-3 text-center">
                <Button size="sm" variant="ghost" icon="chevronDown" onClick={() => setLimit((l) => l + PAGE)}>
                  {t("common.showMore")}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="reviews"
            title={tab === "pending" && !q && product === "all" && rating === "all" ? t("sales.reviews.inboxZero") : t("sales.reviews.noMatch")}
            description={tab === "pending" ? t("sales.reviews.noPending") : t("sales.reviews.tryAnother")}
          />
        )}
      </Card>

      <AnimatePresence>
        {selected.size ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="fixed inset-x-0 bottom-4 z-[70] mx-auto flex w-[min(560px,calc(100vw-2rem))] flex-wrap items-center gap-2 rounded-2xl border border-a-line-strong bg-a-panel-2/95 p-2 ps-4 shadow-[0_24px_60px_-20px_var(--a-shadow)] backdrop-blur md:start-[248px]"
            role="toolbar"
            aria-label={t("sales.orders.bulkAria")}
          >
            <span className="me-auto text-[13px] font-medium tabular-nums">{t("common.selected", { count: selected.size })}</span>
            <Button size="sm" variant="ghost" icon="eye" loading={busy === "bulk:published"} onClick={() => setStatus([...selected], "published", "bulk:published")}>
              {t("sales.reviews.publish")}
            </Button>
            <Button size="sm" variant="ghost" icon="eyeOff" loading={busy === "bulk:hidden"} onClick={() => setStatus([...selected], "hidden", "bulk:hidden")}>
              {t("sales.reviews.hide")}
            </Button>
            <ConfirmButton size="sm" confirmLabel={t("sales.drafts.deleteN", { count: selected.size })} onConfirm={() => remove([...selected])}>
              {t("common.delete")}
            </ConfirmButton>
            <IconBtn icon="close" label={t("sales.orders.clearSelection")} onClick={() => setSelected(new Set())} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ImportDrawer open={importing} onClose={() => setImporting(false)} />
      <AddReviewDrawer open={adding} onClose={() => setAdding(false)} products={products} today={today} onSaved={() => (setAdding(false), router.refresh())} />
    </>
  );
}

function ReviewItem({ r, index, product, selected, onSelect, busy, onStatus, onDelete, onReplied }: { r: StoredReview; index: number; product?: ProductLite; selected: boolean; onSelect: () => void; busy: string | null; onStatus: (s: Status) => void; onDelete: () => void; onReplied: () => void }) {
  const { t, fmt } = useT();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply ?? "");
  const [saving, setSaving] = useState(false);
  const st = STATUS_TONE[r.status];
  const saveReply = async (text: string) => {
    setSaving(true);
    const res = await saveReviewReply(r.id, text);
    setSaving(false);
    if (!res.ok) return toast.error(t("sales.reviews.replyFail"), res.error);
    toast.success(text.trim() ? t("sales.reviews.replyPublished") : t("sales.reviews.replyRemoved"));
    setReplying(false);
    onReplied();
  };
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease, delay: Math.min(index % PAGE, 10) * 0.02 } }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      className={cx("group border-b border-a-line/70 last:border-0", selected && "bg-a-violet/[0.05]")}
    >
      <div className="flex gap-3.5 px-5 py-4">
        <div className="pt-1">
          <Checkbox checked={selected} onChange={onSelect} label={<span className="sr-only">{t("sales.reviews.selectBy", { author: r.author })}</span>} />
        </div>
        <Thumb src={product?.image ?? ""} alt={product?.title ?? ""} size={44} className="hidden sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Stars value={r.rating} />
            <Badge tone={st.tone} dot>
              {t(`sales.reviews.status.${r.status}`)}
            </Badge>
            {r.demo ? <DemoBadge /> : null}
            {r.verified ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-a-ok">
                <AIcon name="check" size={12} strokeWidth={2.2} /> {t("sales.reviews.verified")}
              </span>
            ) : null}
            {r.incentivized ? (
              <Badge tone="violet">
                <AIcon name="gift" size={11} /> {t("reviews.incentivized")}
              </Badge>
            ) : null}
            {product ? (
              <Link href={`/admin/products/${product.id}`} className="truncate text-[12px] text-a-faint hover:text-a-accent">
                {product.title}
              </Link>
            ) : null}
          </div>
          {r.title ? <p className="mt-1.5 text-[13.5px] font-medium">{r.title}</p> : null}
          <p className="mt-1 line-clamp-3 max-w-[75ch] text-[13px] leading-relaxed text-a-dim">{r.body}</p>
          <p className="mt-2 text-[12px] text-a-faint">
            {r.author}
            {r.city ? ` · ${r.city}` : ""} · {fmt.date(`${r.date}T12:00:00Z`)}
            {r.size ? ` · ${t("sales.order.size", { size: r.size })}` : ""}
            {r.fit ? ` · ${t(`sales.reviews.fitLower.${r.fit}`)}` : ""}
            {r.source ? ` · ${t("reviews.via", { source: t(`reviews.source.${sourceKey(r.source)}`) })}` : r.requestId ? ` · ${t("reviews.viaLink")}` : r.id.includes("-u") ? ` · ${t("sales.reviews.viaStore")}` : r.id.includes("-m") ? ` · ${t("sales.reviews.byAdmin")}` : ""}
          </p>
          {r.photos?.length ? (
            <AdminReviewPhotos reviewId={r.id} photos={r.photos} author={r.author} />
          ) : r.photo ? (
            <span className="relative mt-2.5 block size-16 overflow-hidden rounded-lg bg-[#f1f1ee] ring-1 ring-a-line">
              <Image src={r.photo} alt={t("sales.reviews.photoBy", { author: r.author })} fill sizes="64px" className="object-cover" />
            </span>
          ) : null}
          {r.rewardCode ? <RewardChip reviewId={r.id} code={r.rewardCode} sentAt={r.rewardSentAt} /> : null}

          {r.reply && !replying ? (
            <div className="mt-3 rounded-lg border-s-2 border-a-violet/60 bg-a-panel-2 px-3 py-2 text-[12.5px]">
              <p className="font-medium text-a-accent">{t("sales.reviews.yourReply")}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-a-dim">{r.reply}</p>
            </div>
          ) : null}
          <AnimatePresence initial={false}>
            {replying ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                <div className="mt-3">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("sales.reviews.replyPh", { name: r.author.split(" ")[0] })} aria-label={t("sales.reviews.reply")} dir="auto" autoFocus className="min-h-[72px]" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" loading={saving} disabled={!reply.trim()} onClick={() => saveReply(reply)}>
                      {t("sales.reviews.publishReply")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => (setReplying(false), setReply(r.reply ?? ""))}>
                      {t("common.cancel")}
                    </Button>
                    {r.reply ? (
                      <Button size="sm" variant="ghost" className="ms-auto text-a-danger" onClick={() => saveReply("")}>
                        {t("sales.reviews.removeReply")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
          {r.status !== "published" ? (
            <Button size="xs" variant="secondary" icon="eye" loading={busy === `${r.id}:published`} onClick={() => onStatus("published")}>
              {t("sales.reviews.publish")}
            </Button>
          ) : (
            <Button size="xs" variant="ghost" icon="eyeOff" loading={busy === `${r.id}:hidden`} onClick={() => onStatus("hidden")}>
              {t("sales.reviews.hide")}
            </Button>
          )}
          <IconBtn icon="mail" label={r.reply ? t("sales.reviews.editReply") : t("sales.reviews.reply")} onClick={() => setReplying((v) => !v)} size={28} />
          <ConfirmButton size="xs" variant="ghost" confirmLabel={t("sales.discounts.deleteQ")} onConfirm={onDelete}>
            <span className="sr-only">{t("sales.reviews.deleteReview")}</span>
          </ConfirmButton>
        </div>
      </div>
    </motion.li>
  );
}

function AddReviewDrawer({ open, onClose, products, today, onSaved }: { open: boolean; onClose: () => void; products: ProductLite[]; today: string; onSaved: () => void }) {
  const blank = (): NewReviewInput => ({ productId: products[0]?.id ?? "", author: "", city: "", rating: 5, title: "", body: "", size: products[0]?.sizes[0] ?? "M", date: today, verified: false, fit: "true", height: 170, weight: 70, status: "published" });
  const { t } = useT();
  const [f, setF] = useState<NewReviewInput>(blank);
  const [was, setWas] = useState(open);
  const [saving, setSaving] = useState(false);
  if (was !== open) {
    setWas(open);
    if (open) setF(blank());
  }
  const set = (p: Partial<NewReviewInput>) => setF((x) => ({ ...x, ...p }));
  const product = products.find((p) => p.id === f.productId);
  const save = async () => {
    setSaving(true);
    const res = await createReview(f);
    setSaving(false);
    if (!res.ok) return toast.error(t("sales.reviews.addFail"), res.error);
    toast.success(t("sales.reviews.added"), f.status === "published" ? t("sales.reviews.liveOnPage") : undefined);
    onSaved();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("sales.reviews.addTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={saving} onClick={save} disabled={!f.author.trim() || f.body.trim().length < 3}>
            {t("sales.reviews.add")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("sales.reviews.f.product")} htmlFor="rv-product">
          <Select id="rv-product" value={f.productId} onChange={(e) => set({ productId: e.target.value, size: products.find((p) => p.id === e.target.value)?.sizes[0] ?? f.size })}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("sales.reviews.f.rating")}>
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t("sales.reviews.f.rating")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.button key={n} type="button" role="radio" aria-checked={f.rating === n} aria-label={t("sales.reviews.nStars", { count: n })} whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.12 }} onClick={() => set({ rating: n })} className="p-0.5">
                <svg width={26} height={26} viewBox="0 0 24 24" className={cx("transition-colors", n <= f.rating ? "text-[#f5b545]" : "text-a-ink/15")} aria-hidden>
                  <path fill="currentColor" d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8L12 3.5Z" />
                </svg>
              </motion.button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("sales.reviews.f.author")} htmlFor="rv-author">
            <Input id="rv-author" value={f.author} onChange={(e) => set({ author: e.target.value })} placeholder={t("sales.reviews.f.authorPh")} />
          </Field>
          <Field label={t("sales.reviews.f.city")} htmlFor="rv-city">
            <Input id="rv-city" value={f.city} onChange={(e) => set({ city: e.target.value })} placeholder={t("sales.reviews.f.cityPh")} />
          </Field>
        </div>
        <Field label={t("sales.reviews.f.title")} htmlFor="rv-title">
          <Input id="rv-title" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={t("sales.reviews.f.titlePh")} />
        </Field>
        <Field label={t("sales.reviews.f.body")} htmlFor="rv-body">
          <Textarea id="rv-body" dir="auto" value={f.body} onChange={(e) => set({ body: e.target.value })} className="min-h-[110px]" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("sales.reviews.f.size")} htmlFor="rv-size">
            <Select id="rv-size" value={f.size} onChange={(e) => set({ size: e.target.value })}>
              {(product?.sizes ?? ["M"]).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("sales.reviews.f.fit")} htmlFor="rv-fit">
            <Select id="rv-fit" value={f.fit} onChange={(e) => set({ fit: e.target.value as NewReviewInput["fit"] })}>
              <option value="small">{t("sales.reviews.fit.small")}</option>
              <option value="true">{t("sales.reviews.fit.true")}</option>
              <option value="large">{t("sales.reviews.fit.large")}</option>
            </Select>
          </Field>
          <Field label={t("common.date")} htmlFor="rv-date">
            <Input id="rv-date" type="date" max={today} value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label={t("sales.reviews.f.height")} htmlFor="rv-h">
            <Input id="rv-h" type="number" suffix={t("sales.reviews.f.cm")} value={f.height ?? ""} onChange={(e) => set({ height: Number(e.target.value) || undefined })} />
          </Field>
          <Field label={t("sales.reviews.f.weight")} htmlFor="rv-w">
            <Input id="rv-w" type="number" suffix={t("sales.reviews.f.kg")} value={f.weight ?? ""} onChange={(e) => set({ weight: Number(e.target.value) || undefined })} />
          </Field>
          <Field label={t("common.status")} htmlFor="rv-status">
            <Select id="rv-status" value={f.status} onChange={(e) => set({ status: e.target.value as Status })}>
              <option value="published">{t("sales.reviews.status.published")}</option>
              <option value="pending">{t("sales.reviews.status.pending")}</option>
              <option value="hidden">{t("sales.reviews.status.hidden")}</option>
            </Select>
          </Field>
        </div>
        <div className="rounded-xl border border-a-line bg-a-panel-2/50 p-4">
          <Switch checked={f.verified} onChange={(verified) => set({ verified })} label={t("sales.reviews.f.verified")} description={t("sales.reviews.f.verifiedHint")} />
        </div>
      </div>
    </Drawer>
  );
}
