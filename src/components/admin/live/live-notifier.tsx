"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/components/admin/i18n";
import { AIcon } from "@/components/admin/icons";
import { ease, egp } from "@/components/admin/ui";
import { cx } from "@/lib/format";

export interface LiveState {
  latest: { number: string; at: string; total: number; name: string } | null;
  pendingOrders: number;
  unreadMessages: number;
  pendingReviews: number;
}

const POLL_MS = 10_000;
/**
 * Pages that are safe to refresh in place. Editors (products, settings, homepage, order detail…)
 * hold unsaved drafts that a server refresh would reset, so there we only show the toast.
 */
const REFRESHABLE = /^\/admin(\/(orders|reviews|messages|customers|analytics|activity))?\/?$/;
const MUTE_KEY = "verda:admin:mute";

/* ── mute preference (localStorage, shared across tabs) ── */
const muteSubs = new Set<() => void>();
function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeMuted(v: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {}
  muteSubs.forEach((f) => f());
}
function useMuted() {
  return useSyncExternalStore(
    (f) => {
      muteSubs.add(f);
      const onStorage = (e: StorageEvent) => e.key === MUTE_KEY && f();
      window.addEventListener("storage", onStorage);
      return () => (muteSubs.delete(f), window.removeEventListener("storage", onStorage));
    },
    readMuted,
    () => false,
  );
}

/** Two soft sine notes — a "new order" chime, generated with Web Audio (no asset). */
function chime(ctx: AudioContext) {
  const t = ctx.currentTime;
  [880, 1318.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const s = t + i * 0.13;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.38);
    o.connect(g).connect(ctx.destination);
    o.start(s);
    o.stop(s + 0.4);
  });
}

type Alert = { id: number; number: string; total: number; name: string; extra: number };

/**
 * Polls /api/admin/live every 10s. A new order → toast + chime (mutable) + router.refresh()
 * so lists, badges and the overview update in place. Badge changes (messages, reviews) refresh silently.
 */
export function LiveNotifier({ initial }: { initial: LiveState }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, isRtl } = useT();
  const tabPrefix = `${t("overview.live.tabTitle")} — `;
  const tabRef = useRef(tabPrefix);
  const pathRef = useRef(pathname);
  const muted = useMuted();
  const mutedRef = useRef(muted);
  const last = useRef(initial);
  const audio = useRef<AudioContext | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    mutedRef.current = muted;
    pathRef.current = pathname;
    tabRef.current = tabPrefix;
  }, [muted, pathname, tabPrefix]);

  // Browsers only let audio start after a user gesture (sticky activation), so the context is unlocked after
  // the first one — but off the gesture's own task: creating an AudioContext opens the audio device (~100ms
  // of main thread), and the first gesture is usually a sidebar click, which made the first navigation jank.
  useEffect(() => {
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const create = () => {
      try {
        audio.current ??= new AudioContext();
        if (audio.current.state === "suspended") void audio.current.resume();
      } catch {}
    };
    const unlock = () => {
      const a = audio.current;
      if (a) {
        // Safari keeps a context created outside a gesture suspended: resuming (cheap) needs a later gesture
        if (a.state === "suspended") {
          void a.resume();
        } else {
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        }
        return;
      }
      if (idle || timer) return;
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(create, { timeout: 4000 });
      else timer = setTimeout(create, 1500);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (idle) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live", { cache: "no-store" });
      if (res.status === 401) return void router.refresh(); // session ended → layout redirects to login
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as LiveState;
      setOnline(true);
      const prev = last.current;
      last.current = next;
      const isNew = next.latest && next.latest.number !== prev.latest?.number && (!prev.latest || next.latest.at > prev.latest.at);
      if (isNew && next.latest) {
        const extra = Math.max(0, next.pendingOrders - prev.pendingOrders - 1);
        setAlert({ id: Date.now(), number: next.latest.number, total: next.latest.total, name: next.latest.name, extra });
        if (!mutedRef.current) {
          try {
            audio.current ??= new AudioContext();
            if (audio.current.state === "running") chime(audio.current);
          } catch {}
        }
        if (document.hidden) document.title = `${tabRef.current}${document.title.replace(/^● [^—]+ — /, "")}`;
      }
      const changed = isNew || next.pendingOrders !== prev.pendingOrders || next.unreadMessages !== prev.unreadMessages || next.pendingReviews !== prev.pendingReviews;
      if (changed && REFRESHABLE.test(pathRef.current)) router.refresh();
    } catch {
      setOnline(false);
    }
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => void poll(), POLL_MS);
    const onVis = () => {
      if (!document.hidden) {
        document.title = document.title.replace(/^● [^—]+ — /, "");
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => (clearInterval(id), document.removeEventListener("visibilitychange", onVis));
  }, [poll]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 9000);
    return () => clearTimeout(t);
  }, [alert]);

  return (
    <>
      {/* live indicator + sound toggle */}
      <button
        type="button"
        onClick={() => writeMuted(!muted)}
        className="fixed bottom-4 start-4 z-[60] md:start-[264px] hidden items-center gap-2 rounded-full border border-a-line bg-a-panel/90 px-3 py-1.5 text-[11.5px] text-a-dim shadow-[0_10px_30px_-12px_var(--a-shadow-soft)] backdrop-blur transition hover:border-a-line-strong hover:text-a-text lg:inline-flex"
        aria-pressed={!muted}
        aria-label={muted ? t("overview.live.soundOffLabel") : t("overview.live.soundOnLabel")}
        title={muted ? t("overview.live.soundOff") : t("overview.live.soundOn")}
      >
        <span className="relative flex size-2">
          {online ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-a-ok/60 motion-reduce:hidden" /> : null}
          <span className={cx("relative inline-flex size-2 rounded-full", online ? "bg-a-ok" : "bg-a-faint")} />
        </span>
        {online ? t("overview.live.live") : t("overview.live.reconnecting")}
        <AIcon name="bell" size={13} className={muted ? "opacity-40" : ""} />
        {muted ? <span className="sr-only">{t("overview.live.muted")}</span> : null}
      </button>

      <div className="pointer-events-none fixed end-4 top-4 z-[95] w-[340px] max-w-[calc(100vw-2rem)]" aria-live="assertive">
        <AnimatePresence>
          {alert ? (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -18, scale: 0.94, rotateX: -18 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, x: isRtl ? -40 : 40, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease }}
              style={{ transformPerspective: 800 }}
              className="pointer-events-auto overflow-hidden rounded-2xl border border-a-line-strong bg-a-panel-2/95 shadow-[0_24px_60px_-20px_var(--a-shadow)] backdrop-blur"
              role="status"
            >
              <motion.div className="h-0.5 origin-left bg-a-ok rtl:origin-right" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 9, ease: "linear" }} />
              <div className="flex items-start gap-3 p-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-a-ok/15 text-a-ok">
                  <AIcon name="orders" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">
                    {t("overview.live.newOrder", { number: `\u2066${alert.number}\u2069`, total: `\u2066${egp(alert.total)}\u2069` })}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-a-dim">
                    {alert.name}
                    {alert.extra ? ` · ${t("overview.live.more", { count: alert.extra })}` : ""}
                  </p>
                  <div className="mt-2.5 flex items-center gap-3 text-[12px]">
                    <Link href={`/admin/orders/${alert.number}`} onClick={() => setAlert(null)} className="font-medium text-a-accent hover:underline">
                      {t("overview.live.view")}
                    </Link>
                    <button type="button" onClick={() => writeMuted(!muted)} className="text-a-faint hover:text-a-text">
                      {muted ? t("overview.live.unmute") : t("overview.live.mute")}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setAlert(null)} aria-label={t("overview.live.dismiss")} className="grid size-7 place-items-center rounded-full text-a-faint hover:bg-a-panel hover:text-a-text">
                  <AIcon name="close" size={14} />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
