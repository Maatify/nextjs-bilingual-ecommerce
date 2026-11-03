"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestReview } from "@/app/admin/(panel)/reviews/actions";
import type { ActionResult } from "@/server/admin";
import { useT } from "../i18n";
import { Button, Modal, toast } from "../ui";

/**
 * Open WhatsApp for a link the server creates asynchronously. The window is opened synchronously inside the click
 * (so pop-up blockers allow it) and pointed at wa.me once the action returns.
 */
export async function openWhatsApp(get: () => Promise<ActionResult<{ href: string }>>, msgs: { fail: string; blocked: string }) {
  const w = window.open("about:blank", "_blank");
  const res = await get();
  if (!res.ok || !res.data) {
    w?.close();
    toast.error(msgs.fail, res.ok ? undefined : res.error);
    return false;
  }
  if (w) {
    w.opener = null;
    w.location.href = res.data.href;
  } else {
    toast.error(msgs.blocked);
    window.location.href = res.data.href;
  }
  return true;
}

/** "Request review" — creates one personal link and opens WhatsApp with the friendly message. */
export function useReviewRequest() {
  const router = useRouter();
  const { t } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const send = async (orderId: string) => {
    setBusy(orderId);
    const ok = await openWhatsApp(() => requestReview(orderId), { fail: t("reviews.request.fail"), blocked: t("reviews.request.popupBlocked") });
    setBusy(null);
    if (ok) {
      toast.success(t("reviews.request.opened"), t("reviews.request.openedBody"));
      router.refresh();
    }
    return ok;
  };
  return { send, busy };
}

/** Shown right after an order is marked delivered (Admin → Reviews → prompt switch). */
export function RequestPromptModal({ open, onClose, orderId, name }: { open: boolean; onClose: () => void; orderId: string; name: string }) {
  const { t } = useT();
  const { send, busy } = useReviewRequest();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("reviews.request.promptTitle", { name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("reviews.request.promptLater")}
          </Button>
          <Button variant="primary" icon="whatsapp" loading={busy === orderId} onClick={async () => (await send(orderId)) && onClose()}>
            {t("reviews.request.promptSend")}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-a-dim">{t("reviews.request.promptBody")}</p>
    </Modal>
  );
}
