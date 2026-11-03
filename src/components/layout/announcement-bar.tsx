import Link from "@/components/i18n/link";
import { getContent } from "@/lib/data";
import { localizeContent } from "@/lib/i18n/store/content";
import { getLocale } from "@/lib/i18n/store/server";
import { multiBuyLabel } from "@/lib/pricing";

/**
 * Calm CSS-only marquee: three short messages, slow, pauses on hover/focus,
 * static under reduced motion. Runs right-to-left-mirrored on Arabic pages (keyframes read --mq-dir).
 */
export async function AnnouncementBar() {
  const locale = await getLocale();
  const MESSAGES = localizeContent(getContent(), locale)
    .announcement.filter((m) => m.label.trim())
    .map((m) => ({ text: m.label, href: m.href || "/" }));
  // live multi-buy offer (on/off in admin settings) leads the bar unless the merchant already wrote it in
  const multi = multiBuyLabel(locale);
  if (multi && !MESSAGES.some((m) => m.text.includes("%"))) MESSAGES.unshift({ text: multi, href: "/collections/all" });
  if (!MESSAGES.length) return null;
  // Repeat the set so one half is always wider than the widest viewport (seamless -50% loop).
  const ROW = Array.from({ length: Math.max(3, Math.ceil(9 / MESSAGES.length)) }, () => MESSAGES).flat();
  const row = (hidden?: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {ROW.map((m, i) => (
        <li key={i} className="flex items-center" aria-hidden={!hidden && i >= MESSAGES.length ? true : undefined}>
          <Link href={m.href} tabIndex={hidden || i >= MESSAGES.length ? -1 : undefined} className="whitespace-nowrap px-5 transition-colors hover:text-sage md:px-8">
            {m.text}
          </Link>
          <span aria-hidden className="text-white/40">
            ✱
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="group relative z-50 overflow-hidden bg-ink text-white">
      <div className="flex h-8 w-max animate-[marquee_60s_linear_infinite] items-center font-poster text-[13px] tracking-[0.08em] group-focus-within:animate-none group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {row()}
        {row(true)}
      </div>
    </div>
  );
}
