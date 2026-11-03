"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/format";

/** Mobile bar that jumps back to the order form whenever it's off-screen. */
export function LpStickyCta({ price }: { price: number }) {
  const [show, setShow] = useState(false);
  const { d, money } = useI18n();

  useEffect(() => {
    const el = document.getElementById("order");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { rootMargin: "0px 0px -20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-transform duration-300 ease-[var(--ease-out-soft)] md:hidden",
        show ? "translate-y-0" : "translate-y-[calc(100%+16px)]",
      )}
      aria-hidden={!show}
    >
      <a
        href="#order"
        tabIndex={show ? 0 : -1}
        className="tap flex h-14 items-center justify-between gap-3 rounded-full bg-ink ps-6 pe-2 text-white shadow-lift active:scale-[0.98]"
      >
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold">{d.lp.sticky.orderNow}</span>
          <span className="text-[12px] text-white/70">{d.common.payOnDelivery}</span>
        </span>
        <span className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[15px] font-semibold text-ink tabular-nums">
          {money(price)} <Icon name="arrowUpRight" size={16} />
        </span>
      </a>
    </div>
  );
}
