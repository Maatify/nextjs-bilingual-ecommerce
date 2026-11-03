import "@/server/boot";
import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/checkout/contact-form";
import { JsonLd } from "@/components/json-ld";
import { Icon, type IconName } from "@/components/ui/icon";
import { Accordion } from "@/components/ui/primitives";
import { getPage, getPages } from "@/lib/content";
import { getContent } from "@/lib/data";
import { asLocale, ogLocale } from "@/lib/i18n/store/config";
import { localizeContent, localizePage } from "@/lib/i18n/store/content";
import type { Dict } from "@/lib/i18n/store/en";
import { getI18n } from "@/lib/i18n/store/server";
import { alternatesFor, brandOgImages, breadcrumbLd, faqLd } from "@/lib/seo";
import { getSite } from "@/lib/site";
import { CHARTS } from "@/lib/size";

export const dynamicParams = true;

export function generateStaticParams() {
  return getPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/pages/[slug]">): Promise<Metadata> {
  const { slug, lang } = await params;
  const locale = asLocale(lang);
  const base = getPage(slug);
  if (!base) return {};
  const page = localizePage(base, locale);
  const title = `${page.title} ${page.accent ?? ""}`.trim();
  const alternates = alternatesFor(`/pages/${page.slug}`, locale);
  return {
    title,
    description: page.description,
    alternates,
    openGraph: { type: "website", siteName: getSite().name, title, description: page.description, url: alternates.canonical as string, locale: ogLocale(locale), images: brandOgImages(locale) },
  };
}

/** Only the charts our catalog uses — every piece is unisex XS–XXL. */
const SIZE_CHARTS: { key: "tops" | "bottoms" }[] = [{ key: "tops" }, { key: "bottoms" }];

export default async function ContentPage({ params }: PageProps<"/[lang]/pages/[slug]">) {
  const { slug } = await params;
  const base = getPage(slug);
  if (!base) notFound();
  const { d, locale } = await getI18n();
  const P = d.pages;
  const page = localizePage(base, locale);
  const site = getSite();
  const pages = getPages().map((x) => localizePage(x, locale));
  const faq = localizeContent(getContent(), locale).faq;

  return (
    <div className="container-x pb-16 pt-6 md:pt-10">
      <JsonLd
        data={[
          breadcrumbLd(
            [
              { name: d.common.home, path: "/" },
              { name: page.nav, path: `/pages/${page.slug}` },
            ],
            locale,
          ),
          ...(slug === "faq" ? [faqLd(faq.flatMap((g) => g.items), locale)] : []),
        ]}
      />

      <nav aria-label={P.breadcrumb} className="mb-6 text-[14px] text-muted">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-ink">
              {d.common.home}
            </Link>
          </li>
          <li aria-hidden>
            <Icon name="chevronRight" size={13} />
          </li>
          <li aria-current="page" className="text-ink">
            {page.nav}
          </li>
        </ol>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <aside className="order-last min-w-0 lg:order-first">
          <nav aria-label={P.helpPages} className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:rounded-[24px] lg:bg-surface lg:p-3">
            <ul className="no-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0">
              {pages.map((p) => (
                <li key={p.slug} className="shrink-0">
                  <Link
                    href={`/pages/${p.slug}`}
                    aria-current={p.slug === slug ? "page" : undefined}
                    className={
                      p.slug === slug
                        ? "flex h-11 items-center rounded-full bg-ink px-4 text-[15px] font-semibold text-white"
                        : "flex h-11 items-center rounded-full bg-surface px-4 text-[15px] font-medium text-ink-2 transition hover:text-ink lg:bg-transparent lg:hover:bg-surface-2"
                    }
                  >
                    {p.nav}
                  </Link>
                </li>
              ))}
              <li className="shrink-0">
                <Link href="/track-order" className="flex h-11 items-center rounded-full bg-surface px-4 text-[15px] font-medium text-ink-2 transition hover:text-ink lg:bg-transparent lg:hover:bg-surface-2">
                  {d.common.trackOrder}
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 space-y-4">
          <header className="rounded-[28px] bg-surface p-5 md:p-10">
            <h1 className="text-poster text-balance">
              {page.title} {page.accent}
              <span className="sr-only"> — {site.name}</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-ink-2 text-pretty">{page.intro}</p>
          </header>

          {slug === "faq" ? (
            <div className="rounded-[28px] bg-surface p-5 md:p-10">
              <div className="max-w-[760px] space-y-10">
                {faq.map((g, gi) => (
                  <section key={g.group} aria-labelledby={`faq-g${gi}`}>
                    <h2 id={`faq-g${gi}`} className="mb-1 text-h3">
                      {g.group}
                    </h2>
                    <div>
                      {g.items.map((it) => (
                        <Accordion key={it.q} title={it.q}>
                          <p className="max-w-[62ch]">{it.a}</p>
                        </Accordion>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {page.sections.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {page.sections.map((s) => (
                <section key={s.heading} className="rounded-[28px] bg-surface p-5 md:p-8">
                  <h2 className="mb-3 text-h3">{s.heading}</h2>
                  <div className="space-y-3 text-[16px] leading-relaxed text-ink-2">
                    {s.body.map((b) => (
                      <p key={b}>{b}</p>
                    ))}
                  </div>
                  {s.list ? (
                    <ul className="mt-4 space-y-2.5 text-[15px] leading-snug">
                      {s.list.map((li) => (
                        <li key={li} className="flex gap-2.5">
                          <Icon name="check" size={18} strokeWidth={2} className="mt-px shrink-0" />
                          {li}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          ) : null}

          {slug === "size-guide" ? (
            <div className="space-y-4">
              {SIZE_CHARTS.map(({ key: k }) => (
                <section key={k} aria-labelledby={`chart-${k}`} className="rounded-[28px] bg-surface p-5 md:p-8">
                  <h2 id={`chart-${k}`} className="mb-4 text-h3">
                    {P.charts[k]} <span className="text-[14px] font-medium text-muted">{P.cm}</span>
                  </h2>
                  <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
                    <table className="w-full min-w-[420px] text-start text-[15px] tabular-nums">
                      <thead>
                        <tr className="border-b border-line">
                          {CHARTS[k].head.map((h) => (
                            <th key={h} scope="col" className="py-3 pe-4 text-[13px] font-medium text-muted">
                              {chartHead(P, h)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CHARTS[k].rows.map((r) => (
                          <tr key={String(r[0])} className="border-b border-line last:border-0">
                            {r.map((c, i) =>
                              i === 0 ? (
                                <th key={i} scope="row" className="py-3 pe-4 font-semibold">
                                  {c}
                                </th>
                              ) : (
                                <td key={i} className="py-3 pe-4 text-ink-2">
                                  {c}
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {slug === "contact" ? <ContactBlock d={d} /> : null}

          <aside className="flex flex-col gap-4 rounded-[28px] bg-ink p-5 text-white sm:flex-row sm:items-center md:p-10">
            <div className="flex-1">
              <p className="text-h3">{P.stuck}</p>
              <p className="mt-1 text-[15px] text-white/70">{P.waHours}</p>
            </div>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="tap flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-ink transition hover:bg-surface-2 active:scale-95">
              <Icon name="whatsapp" size={19} /> {P.chat} <Icon name="arrowUpRight" size={16} />
            </a>
          </aside>
        </article>
      </div>
    </div>
  );
}

const chartHead = (P: Dict["pages"], h: string) => P.chartHead[h as keyof Dict["pages"]["chartHead"]] ?? h;

function ContactBlock({ d }: { d: Dict }) {
  const site = getSite();
  const c = d.pages.contact;
  const channels: { icon: IconName; t: string; v: string; h: string; s: string }[] = [
    { icon: "whatsapp", t: c.whatsapp, v: site.phone, h: `https://wa.me/${site.whatsapp}`, s: c.whatsappNote },
    { icon: "phone", t: c.call, v: site.phone, h: `tel:${site.phone.replace(/\s/g, "")}`, s: c.callNote },
    { icon: "mail", t: c.email, v: site.email, h: `mailto:${site.email}`, s: c.emailNote },
  ];
  return (
    <div className="space-y-4">
      <ul className="grid gap-4 sm:grid-cols-3">
        {channels.map((c) => (
          <li key={c.t}>
            <a href={c.h} target={c.h.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex h-full flex-col gap-3 rounded-[28px] bg-surface p-5 transition hover:shadow-soft md:p-6">
              <span className="grid size-10 place-items-center rounded-full bg-surface-2">
                <Icon name={c.icon} size={19} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{c.t}</span>
                <span dir="ltr" className="block break-all text-start text-[14px] text-ink-2 rtl:text-end">
                  {c.v}
                </span>
                <span className="mt-1 block text-[13px] text-muted">{c.s}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <section aria-labelledby="contact-form-h" className="rounded-[28px] bg-surface p-5 md:p-8">
        <h2 id="contact-form-h" className="mb-5 text-h3">
          {d.pages.contact.send}
        </h2>
        <ContactForm />
      </section>
    </div>
  );
}
