import Link from "@/components/i18n/link";
import { Icon } from "@/components/ui/icon";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getContent } from "@/lib/data";
import { localizeContent } from "@/lib/i18n/store/content";
import { getI18n } from "@/lib/i18n/store/server";
import { getOffer, getSite } from "@/lib/site";
import { socialLinks } from "@/lib/social";
import { NewsletterForm } from "./newsletter-form";
import { PaymentMarks } from "@/components/cart/cart-line";

/** Lungguh-pattern footer: slanted top edge, soft bottom glow, short promise, pill newsletter, (Label) columns, oversized wordmark. */
export async function Footer() {
  const site = getSite();
  const offer = getOffer();
  const { d, t, locale } = await getI18n();
  const f = d.layout.footer;
  const COLS = localizeContent(getContent(), locale).footer.filter((c) => c.links.length);
  return (
    <footer className="slant-top relative mt-20 overflow-hidden bg-white pb-28 md:mt-28 md:pb-0">
      {/* one soft, airy light centred at the bottom, behind the wordmark — wide, diffuse, no hard edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[75%]"
        style={{ background: "radial-gradient(ellipse 65% 70% at 50% 100%, rgb(176 218 140 / 0.34) 0%, rgb(198 230 170 / 0.2) 30%, rgb(222 240 205 / 0.08) 55%, transparent 80%)" }}
      />

      <div className="container-x relative">
        <div className="pt-[calc(4rem+3.5vw)] md:pt-[calc(6rem+3.5vw)]">
          <p className="max-w-[16ch] text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[44px]">
            {f.promise1}
            <br />
            {f.promise2}
          </p>
        </div>

        <div className="mt-12 grid gap-12 md:mt-16 lg:grid-cols-[1fr_1.4fr]">
          <div className="max-w-md">
            <p className="text-[15px] font-semibold">
              {f.newsletter}
              {offer.welcomePct ? t(f.newsletterOff, { pct: offer.welcomePct }) : ""}
            </p>
            <NewsletterForm tone="light" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {COLS.map((c) => (
              <nav key={c.title} aria-label={c.title} className="flex gap-3">
                <p className="shrink-0 text-[13px] font-medium text-muted">({c.title})</p>
                <ul className="space-y-2.5">
                  {c.links.map((l) => (
                    <li key={`${l.href}-${l.label}`}>
                      {/* no prefetch for the footer's link grid: saves ~15 RSC requests per page that reaches the footer */}
                      <Link href={l.href} prefetch={false} className="text-[14px] text-ink-2 transition hover:text-ink">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-line pt-6 md:mt-20 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {[
              ...socialLinks(site).map((n) => ({ h: n.href, i: n.key, l: n.label })),
              { h: site.whatsapp ? `https://wa.me/${site.whatsapp}` : "", i: "whatsapp" as const, l: "WhatsApp" },
            ].filter((s) => s.h).map((s) => (
              <a key={s.l} href={s.h} target="_blank" rel="noopener noreferrer" aria-label={s.l} className="grid size-11 place-items-center rounded-full bg-surface-2 ring-1 ring-line transition hover:bg-ink hover:text-white">
                <Icon name={s.i} size={18} />
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <LanguageSwitcher variant="row" className="h-10 bg-surface-2 ring-1 ring-line" />
            <PaymentMarks className="justify-start md:justify-end" />
          </div>
        </div>

        <div className="flex flex-col gap-2 py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} <bdi>{site.legalName}</bdi>. {f.prices}
          </span>
          <a href={`mailto:${site.email}`} dir="ltr" className="text-ink-2 hover:text-ink">
            {site.email}
          </a>
          <Link href="/pages/privacy" className="hover:text-ink">
            {f.privacy}
          </Link>
        </div>
      </div>

      <p aria-hidden dir="ltr" className="pointer-events-none -mb-[0.2em] select-none text-center text-[34vw] font-semibold leading-[0.8] tracking-[-0.06em] text-[#e4e5e0] md:text-[30vw]">
        {site.name.toLowerCase()}
      </p>
    </footer>
  );
}
