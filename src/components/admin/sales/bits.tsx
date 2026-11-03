"use client";

import Image from "next/image";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import { cx } from "@/lib/format";
import { useT } from "../i18n";
import { AIcon } from "../icons";
import { Badge } from "../ui";
import { METHOD_META, PAYMENT_META, STATUS_META } from "./meta";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const m = STATUS_META[status];
  const { t } = useT();
  return (
    <Badge tone={m.tone} dot className={className}>
      {t(`sales.status.${status}`)}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const m = PAYMENT_META[status];
  const { t } = useT();
  return <Badge tone={m.tone}>{t(`sales.payment.${status}`)}</Badge>;
}

export function DemoBadge() {
  const { t } = useT();
  return (
    <span className="inline-flex h-[18px] items-center rounded-md border border-dashed border-a-line-strong px-1.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-a-faint" title={t("sales.demoTitle")}>
      {t("sales.demo")}
    </span>
  );
}

export function PaymentMethod({ method, className }: { method: Order["paymentMethod"]; className?: string }) {
  const m = METHOD_META[method];
  const { t } = useT();
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[12.5px] text-a-dim", className)}>
      <AIcon name={m.icon} size={14} className="text-a-faint" />
      {t(`sales.method.${method}`)}
    </span>
  );
}

/** Light "well" behind product photos (storefront shots are on off-white). */
export function Thumb({ src, alt, size = 40, className }: { src: string; alt: string; size?: number; className?: string }) {
  return (
    <span className={cx("relative block shrink-0 overflow-hidden rounded-[9px] bg-[#f1f1ee] ring-1 ring-a-line", className)} style={{ width: size, height: size }}>
      {src ? <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" /> : null}
    </span>
  );
}

export function ThumbStack({ lines, max = 3 }: { lines: Order["lines"]; max?: number }) {
  const shown = lines.slice(0, max);
  const extra = lines.length - shown.length;
  const { t } = useT();
  return (
    <span className="flex items-center" aria-label={t("sales.itemsAria", { count: lines.length })}>
      {shown.map((l, i) => (
        <Thumb key={i} src={l.image} alt={l.title} size={30} className={cx("ring-2 ring-a-panel transition-transform group-hover:translate-x-0", i ? "-ms-2.5" : "")} />
      ))}
      {extra > 0 ? <span className="-ms-2 grid size-[30px] place-items-center rounded-[9px] bg-a-panel-2 text-[11px] font-medium text-a-dim ring-2 ring-a-panel"><bdi dir="ltr">+{extra}</bdi></span> : null}
    </span>
  );
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={t("sales.stars", { value })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden className={i <= value ? "text-[#f5b545]" : "text-a-ink/15"}>
          <path fill="currentColor" d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8L12 3.5Z" />
        </svg>
      ))}
    </span>
  );
}

/** Copy text to clipboard with a toast. */
export async function copyText(text: string, toastFn: (t: string) => void, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toastFn(label);
  } catch {
    /* clipboard blocked */
  }
}
