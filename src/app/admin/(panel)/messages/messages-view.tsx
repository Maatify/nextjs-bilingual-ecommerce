"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { useT } from "@/components/admin/i18n";
import { AIcon } from "@/components/admin/icons";
import { Badge, Button, Card, ConfirmButton, Drawer, EmptyState, Input, LinkButton, PageHeader, Tabs, ease, toast } from "@/components/admin/ui";
import { cx } from "@/lib/format";
import type { ContactMessage } from "@/server/store";
import { markMessages, removeMessages } from "./actions";

type TabV = "all" | "unread" | "read";
const TOPICS = { order: "order", exchange: "exchange", product: "product", other: "else" } as const;
const FULL: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };

/** E.164 for wa.me — Egyptian 01xxxxxxxxx → 201xxxxxxxxx. */
const waNumber = (phone: string) => (phone.startsWith("0") ? `2${phone}` : phone);

export function MessagesView({ messages }: { messages: ContactMessage[] }) {
  const router = useRouter();
  const { t, fmt } = useT();
  const topic = (k: string) => (k in TOPICS ? t(`sales.messages.topic.${TOPICS[k as keyof typeof TOPICS]}`) : k);
  const [tab, setTab] = useState<TabV>(() => (messages.some((m) => !m.read) ? "unread" : "all"));
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim().toLowerCase());
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => ({ all: messages.length, unread: messages.filter((m) => !m.read).length, read: messages.filter((m) => m.read).length }), [messages]);
  const rows = useMemo(
    () =>
      messages.filter(
        (m) =>
          (tab === "all" || (tab === "unread" ? !m.read : m.read)) &&
          (!dq || [m.name, m.phone, m.email, m.message].some((v) => v?.toLowerCase().includes(dq))),
      ),
    [messages, tab, dq],
  );
  const open = messages.find((m) => m.id === openId) ?? null;

  const setRead = async (ids: string[], read: boolean, quiet = false) => {
    setBusy(true);
    const res = await markMessages(ids, read);
    setBusy(false);
    if (!res.ok) return void toast.error(t("sales.reviews.updateFail"), res.error);
    if (!quiet) toast.success(read ? t("sales.messages.markedRead") : t("sales.messages.markedUnread"));
    router.refresh();
  };
  const remove = async (ids: string[]) => {
    const res = await removeMessages(ids);
    if (!res.ok) return void toast.error(t("sales.drafts.deleteFail"), res.error);
    toast.success(t("sales.messages.deleted"));
    setOpenId(null);
    router.refresh();
  };
  const show = (m: ContactMessage) => {
    setOpenId(m.id);
    if (!m.read) void setRead([m.id], true, true);
  };

  return (
    <div>
      <PageHeader
        title={t("sales.messages.title")}
        description={t("sales.messages.description")}
        actions={
          counts.unread ? (
            <Button icon="check" loading={busy} onClick={() => setRead(messages.filter((m) => !m.read).map((m) => m.id), true)}>
              {t("sales.messages.markAll")}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs<TabV>
          value={tab}
          onChange={setTab}
          items={[
            { value: "unread", label: t("sales.messages.unread"), count: counts.unread },
            { value: "all", label: t("common.all"), count: counts.all },
            { value: "read", label: t("sales.messages.read"), count: counts.read },
          ]}
        />
        <div className="relative sm:w-72">
          <AIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-a-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("sales.messages.searchPh")} aria-label={t("sales.messages.searchAria")} className="ps-9" />
        </div>
      </div>

      <Card padded={false}>
        {rows.length ? (
          <ul>
            <AnimatePresence initial={false}>
              {rows.map((m, i) => (
                <motion.li
                  key={m.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease, delay: Math.min(i, 10) * 0.02 } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                  className="border-b border-a-line/70 last:border-0"
                >
                  <button type="button" onClick={() => show(m)} className="group flex w-full items-start gap-3.5 px-5 py-4 text-start transition hover:bg-a-panel-2/60">
                    <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", m.read ? "bg-transparent" : "bg-a-accent")} aria-hidden />
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-a-panel-2 text-[13px] font-semibold uppercase text-a-dim ring-1 ring-a-line">{m.name.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cx("text-[13.5px]", m.read ? "font-medium text-a-dim" : "font-semibold")}>{m.name}</span>
                        {m.topic ? <Badge tone={m.topic === "order" ? "violet" : m.topic === "exchange" ? "amber" : "neutral"}>{topic(m.topic)}</Badge> : null}
                        {!m.read ? <span className="sr-only">{t("sales.messages.unread")}</span> : null}
                      </span>
                      <span dir="auto" className="mt-1 line-clamp-2 block max-w-[80ch] text-start text-[13px] leading-relaxed text-a-dim">{m.message}</span>
                      <span className="mt-1.5 block text-[12px] text-a-faint"><bdi dir="ltr">{[m.phone, m.email].filter(Boolean).join(" · ")}</bdi></span>
                    </span>
                    <span className="shrink-0 text-[12px] tabular-nums text-a-faint" title={fmt.date(m.createdAt, FULL)} suppressHydrationWarning>
                      {fmt.ago(m.createdAt)}
                    </span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <EmptyState
            icon="mail"
            title={messages.length ? (tab === "unread" && !dq ? t("sales.reviews.inboxZero") : t("sales.messages.noMatch")) : t("sales.messages.empty")}
            description={messages.length ? t("sales.checkouts.tryAnother") : t("sales.messages.emptyDesc")}
          />
        )}
      </Card>

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? t("sales.messages.from", { name: open.name }) : ""}
        footer={
          open ? (
            <>
              <ConfirmButton onConfirm={() => remove([open.id])} confirmLabel={t("sales.messages.deleteQ")}>
                {t("common.delete")}
              </ConfirmButton>
              <Button size="sm" variant="ghost" icon={open.read ? "eyeOff" : "eye"} loading={busy} onClick={() => setRead([open.id], !open.read)} className="me-auto">
                {open.read ? t("sales.messages.markUnread") : t("sales.messages.markRead")}
              </Button>
            </>
          ) : null
        }
      >
        {open ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-a-faint">
              <span>{fmt.date(open.createdAt, FULL)}</span>
              {open.topic ? <Badge>{topic(open.topic)}</Badge> : null}
              <Badge tone={open.read ? "neutral" : "violet"} dot>
                {open.read ? t("sales.messages.read") : t("sales.messages.unread")}
              </Badge>
            </div>
            <p dir="auto" className="whitespace-pre-wrap rounded-xl bg-a-panel-2 p-4 text-[14px] leading-relaxed ring-1 ring-a-line">{open.message}</p>
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-a-faint">{t("common.name")}</dt>
                <dd className="mt-0.5 font-medium">{open.name}</dd>
              </div>
              {open.phone ? (
                <div>
                  <dt className="text-[12px] text-a-faint">{t("sales.draft.mobile")}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    <a href={`tel:${open.phone}`} dir="ltr" className="hover:text-a-accent">
                      {open.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {open.email ? (
                <div className="sm:col-span-2">
                  <dt className="text-[12px] text-a-faint">{t("sales.order.edit.email")}</dt>
                  <dd className="mt-0.5 break-all font-medium" dir="ltr">{open.email}</dd>
                </div>
              ) : null}
            </dl>
            <div className="flex flex-wrap gap-2">
              {open.phone ? (
                <LinkButton external variant="primary" icon="whatsapp" href={`https://wa.me/${waNumber(open.phone)}?text=${encodeURIComponent(t("sales.messages.waHello", { name: open.name.split(" ")[0] }))}`}>
                  {t("sales.messages.replyWa")}
                </LinkButton>
              ) : null}
              {open.email ? (
                <LinkButton external variant={open.phone ? "secondary" : "primary"} icon="mail" href={`mailto:${open.email}?subject=${encodeURIComponent(t("sales.messages.emailSubject"))}&body=${encodeURIComponent(`${t("sales.messages.emailHello", { name: open.name.split(" ")[0] })}\n\n> ${open.message.replace(/\n/g, "\n> ")}\n\n`)}`}>
                  {t("sales.messages.replyEmail")}
                </LinkButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
