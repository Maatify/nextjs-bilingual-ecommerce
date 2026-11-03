"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useRef, useState } from "react";
import { importReviews, markReviewRequestSent, previewReviewImport, removeReviewPhotoAction, saveReviewRequestPrompt, sendReward, type ImportPreviewRow } from "@/app/admin/(panel)/reviews/actions";
import { cx } from "@/lib/format";
import type { ReviewSource } from "@/lib/types";
import { AIcon } from "../icons";
import { useT } from "../i18n";
import { Badge, Button, Card, ConfirmButton, Drawer, Modal, Spinner, Switch, Tabs, ease, table, toast } from "../ui";
import { Thumb } from "./bits";
import { openWhatsApp, useReviewRequest } from "./review-request";

/* ───────────── Review requests panel ───────────── */

export interface RequestRow {
  id: string;
  number: string;
  name: string;
  deliveredAt: string;
  items: number;
  image: string;
  requestedAt?: string;
}

const PAGE = 6;

/** Delivered orders not yet asked for a review — one-click WhatsApp + "mark sent", and the prompt-after-delivery switch. */
export function RequestsPanel({ rows, prompt }: { rows: RequestRow[]; prompt: boolean }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const { send, busy } = useReviewRequest();
  const [marking, setMarking] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [promptOn, setPromptOn] = useState(prompt);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const togglePrompt = async (v: boolean) => {
    setPromptOn(v);
    setSavingPrompt(true);
    const res = await saveReviewRequestPrompt(v);
    setSavingPrompt(false);
    if (!res.ok) {
      setPromptOn(!v);
      return toast.error(t("reviews.panel.saveFail"), res.error);
    }
    toast.success(t("reviews.panel.saved"));
    router.refresh();
  };
  const markSent = async (id: string) => {
    setMarking(id);
    const res = await markReviewRequestSent(id);
    setMarking(null);
    if (!res.ok) return toast.error(t("common.errors.generic"), res.error);
    toast.success(t("reviews.panel.markedSent"));
    router.refresh();
  };

  const shown = rows.slice(0, limit);
  return (
    <Card title={t("reviews.panel.title")} description={t("reviews.panel.description")} padded={false} className="mb-6">
      <div className="border-b border-a-line px-5 py-3.5">
        <Switch checked={promptOn} disabled={savingPrompt} onChange={togglePrompt} label={t("reviews.panel.promptSwitch")} description={t("reviews.panel.promptSwitchHint")} />
      </div>
      {shown.length ? (
        <>
          <ul>
            <AnimatePresence initial={false}>
              {shown.map((r) => (
                <motion.li key={r.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease }} className="flex flex-wrap items-center gap-3 border-b border-a-line/70 px-5 py-3 last:border-0">
                  <Thumb src={r.image} alt="" size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-medium">
                      <Link href={`/admin/orders/${r.id}`} className="hover:text-a-accent">
                        <bdi dir="ltr">{r.number}</bdi>
                      </Link>
                      <span className="text-a-dim">{r.name}</span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-a-faint">
                      {t("reviews.panel.delivered", { ago: fmt.ago(r.deliveredAt) })} · {t("reviews.panel.items", { count: r.items })}
                      {r.requestedAt ? ` · ${t("reviews.panel.linkCreated", { ago: fmt.ago(r.requestedAt) })}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" icon="whatsapp" loading={busy === r.id} onClick={() => send(r.id)} className="!bg-[#25d366]/12 !text-[#4ae38b] a-light:!text-[#15803d] !ring-[#25d366]/25 hover:!bg-[#25d366]/20">
                      {t("reviews.panel.whatsapp")}
                    </Button>
                    <Button size="sm" variant="ghost" icon="check" loading={marking === r.id} onClick={() => markSent(r.id)}>
                      {t("reviews.panel.markSent")}
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {rows.length > limit ? (
            <div className="border-t border-a-line px-5 py-2.5 text-center">
              <Button size="sm" variant="ghost" icon="chevronDown" onClick={() => setLimit((l) => l + PAGE * 2)}>
                {t("reviews.panel.more", { count: Math.min(PAGE * 2, rows.length - limit) })}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="flex items-center gap-3 px-5 py-4 text-[13px] text-a-dim">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-a-ok/12 text-a-ok">
            <AIcon name="check" size={15} />
          </span>
          <span>
            <span className="font-medium text-a-text">{t("reviews.panel.empty")}</span> · {t("reviews.panel.emptyDesc")}
          </span>
        </p>
      )}
    </Card>
  );
}

/* ───────────── photos (moderation) ───────────── */

export function AdminReviewPhotos({ reviewId, photos, author }: { reviewId: string; photos: string[]; author: string }) {
  const router = useRouter();
  const { t } = useT();
  const [open, setOpen] = useState<string | null>(null);
  const remove = async (url: string) => {
    const res = await removeReviewPhotoAction(reviewId, url);
    if (!res.ok) return toast.error(t("reviews.photos.removeFail"), res.error);
    toast.success(t("reviews.photos.removed"));
    setOpen(null);
    router.refresh();
  };
  return (
    <>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {photos.map((src, i) => (
          <li key={src} className="relative">
            <button type="button" onClick={() => setOpen(src)} aria-label={t("reviews.photos.open", { n: i + 1 })} className="relative block size-16 overflow-hidden rounded-lg bg-[#f1f1ee] ring-1 ring-a-line transition hover:ring-a-violet/60">
              <Image src={src} alt={t("sales.reviews.photoBy", { author })} fill sizes="64px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={t("sales.reviews.photoBy", { author })}
        width="max-w-2xl"
        footer={
          open ? (
            <ConfirmButton size="sm" confirmLabel={t("reviews.photos.removeQ")} onConfirm={() => remove(open)}>
              {t("reviews.photos.remove", { n: photos.indexOf(open) + 1 })}
            </ConfirmButton>
          ) : null
        }
      >
        {open ? (
          <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-xl bg-[#f1f1ee]">
            <Image src={open} alt={t("sales.reviews.photoBy", { author })} fill sizes="560px" className="object-contain" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}

/* ───────────── reward ───────────── */

export function RewardChip({ reviewId, code, sentAt }: { reviewId: string; code: string; sentAt?: string }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    const ok = await openWhatsApp(() => sendReward(reviewId), { fail: t("common.errors.generic"), blocked: t("reviews.request.popupBlocked") });
    setBusy(false);
    if (ok) router.refresh();
  };
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-a-line-strong bg-a-panel-2/60 px-3 py-2 text-[12.5px]">
      <AIcon name="gift" size={14} className="text-a-accent" />
      <span className="text-a-dim">{t("reviews.reward.code")}</span>
      <code dir="ltr" className="font-mono font-medium tracking-wide">
        {code}
      </code>
      {sentAt ? <span className="text-a-faint">· {t("reviews.reward.sent", { ago: fmt.ago(sentAt) })}</span> : null}
      <Button size="xs" icon="whatsapp" variant={sentAt ? "ghost" : "secondary"} loading={busy} onClick={send} className="ms-auto">
        {t("reviews.reward.send")}
      </Button>
    </div>
  );
}

export const sourceKey = (s: ReviewSource) => (s === "other" ? "misc" : s);

/* ───────────── CSV import ───────────── */

const TEMPLATE = [
  "handle,rating,title,body,author,city,date,source",
  // deliberately unimportable example row (unknown handle) — replace it with real reviews
  'example-product-handle,5,"Short title","Paste the customer\'s own words here",Salma H.,Cairo,2026-01-31,instagram',
].join("\r\n");

function downloadTemplate() {
  const blob = new Blob(["﻿" + TEMPLATE + "\r\n"], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "reviews-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function ImportDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<"published" | "pending">("pending");
  const [was, setWas] = useState(open);
  if (was !== open) {
    setWas(open);
    if (open) (setCsv(null), setRows(null), setError(null), setFileName(""));
  }

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setRows(null);
    setFileName(file.name);
    if (file.size > 1024 * 1024) return setError(t("reviews.import.tooBig"));
    const text = await file.text();
    setCsv(text);
    setChecking(true);
    const res = await previewReviewImport(text);
    setChecking(false);
    if (input.current) input.current.value = "";
    if (!res.ok) return setError(res.error);
    setRows(res.data?.rows ?? []);
  };

  const good = rows?.filter((r) => !r.errors.length).length ?? 0;
  const bad = (rows?.length ?? 0) - good;
  const run = async () => {
    if (!csv) return;
    setImporting(true);
    const res = await importReviews(csv, status);
    setImporting(false);
    if (!res.ok) return toast.error(t("reviews.import.fail"), res.error);
    toast.success(t("reviews.import.imported", { count: res.data?.imported ?? 0 }));
    onClose();
    router.refresh();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("reviews.import.title")}
      width="max-w-[760px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" icon="upload" loading={importing} disabled={!good || checking} onClick={run}>
            {t("reviews.import.importN", { count: good })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-a-dim">{t("reviews.import.description")}</p>
        <p className="flex gap-2 rounded-xl bg-a-warn/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-a-warn">
          <AIcon name="alert" size={15} className="mt-0.5 shrink-0" />
          {t("reviews.import.honest")}
        </p>
        <div className="rounded-xl border border-a-line bg-a-panel-2/40 p-4">
          <p className="text-[12.5px] leading-relaxed text-a-dim" dir="auto">
            {t("reviews.import.columns")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex has-[input:focus-visible]:rounded-[10px] has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-a-violet">
              <span className={cx("inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium a-grad text-white")}>
                <AIcon name="upload" size={15} />
                {fileName ? t("reviews.import.replace") : t("reviews.import.choose")}
              </span>
              <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <Button size="sm" variant="ghost" icon="download" onClick={downloadTemplate}>
              {t("reviews.import.template")}
            </Button>
          </div>
          {fileName ? (
            <p className="mt-2 truncate text-[12px] text-a-faint" dir="ltr">
              {fileName}
            </p>
          ) : null}
        </div>

        {checking ? (
          <p className="flex items-center gap-2 text-[13px] text-a-dim" role="status">
            <Spinner size={14} /> {t("reviews.import.reading")}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-a-danger/10 px-3 py-2.5 text-[13px] text-a-danger" role="alert">
            {error}
          </p>
        ) : null}

        {rows ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]" role="status">
              <Badge tone="green" dot>
                {t("reviews.import.rowsOk", { count: good })}
              </Badge>
              {bad ? (
                <Badge tone="red" dot>
                  {t("reviews.import.rowsBad", { count: bad })}
                </Badge>
              ) : null}
            </div>
            <div className={cx(table.wrap, "max-h-[46dvh] rounded-xl border border-a-line a-scroll")}>
              <table className={cx(table.table, "min-w-[680px]")}>
                <thead>
                  <tr>
                    <th className={table.th}>{t("reviews.import.th.row")}</th>
                    <th className={table.th}>{t("reviews.import.th.product")}</th>
                    <th className={table.th}>{t("reviews.import.th.rating")}</th>
                    <th className={table.th}>{t("reviews.import.th.review")}</th>
                    <th className={table.th}>{t("reviews.import.th.author")}</th>
                    <th className={table.th}>{t("reviews.import.th.date")}</th>
                    <th className={table.th}>{t("reviews.import.th.source")}</th>
                    <th className={table.th}>{t("reviews.import.th.check")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Fragment key={r.line}>
                      <tr className={cx(table.tr, r.errors.length > 0 && "bg-a-danger/[0.05] [&>td]:border-b-0")}>
                        <td className={cx(table.td, "tabular-nums text-a-faint")}>{r.line}</td>
                        <td className={cx(table.td, "max-w-[140px] truncate")}>{r.productTitle ?? <span dir="ltr" className="text-a-faint">{r.handle || "—"}</span>}</td>
                        <td className={cx(table.td, "tabular-nums")}>{Number.isFinite(r.rating) ? `${r.rating}★` : "—"}</td>
                        <td className={cx(table.td, "max-w-[220px]")}>
                          <p className="truncate font-medium" dir="auto">
                            {r.title}
                          </p>
                          <p className="line-clamp-2 text-[12px] text-a-dim" dir="auto">
                            {r.body}
                          </p>
                        </td>
                        <td className={table.td}>
                          <bdi>{r.author}</bdi>
                          {r.city ? <span className="block text-[12px] text-a-faint">{r.city}</span> : null}
                        </td>
                        <td className={cx(table.td, "whitespace-nowrap text-a-dim")}>{/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? fmt.date(`${r.date}T12:00:00Z`) : r.date}</td>
                        <td className={table.td}>{t(`reviews.source.${sourceKey(r.source)}`)}</td>
                        <td className={table.td}>{r.errors.length ? <Badge tone="red">{r.errors.length}</Badge> : <Badge tone="green">{t("reviews.import.ok")}</Badge>}</td>
                      </tr>
                      {r.errors.length ? (
                        <tr className="bg-a-danger/[0.05]">
                          <td colSpan={8} className="px-4 pb-3 pt-0">
                            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-a-danger">
                              {r.errors.map((e) => (
                                <li key={e} className="flex items-center gap-1.5">
                                  <AIcon name="alert" size={12} /> {e}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-medium text-a-dim">{t("reviews.import.importAs")}</p>
              <Tabs<"published" | "pending">
                value={status}
                onChange={setStatus}
                items={[
                  { value: "pending", label: t("reviews.import.asPending") },
                  { value: "published", label: t("reviews.import.asPublished") },
                ]}
              />
            </div>
          </>
        ) : null}
      </div>
    </Drawer>
  );
}
