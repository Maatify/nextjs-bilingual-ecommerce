import Link from "@/components/i18n/link";
import { JsonLd } from "@/components/json-ld";
import { Icon } from "@/components/ui/icon";
import { Accordion } from "@/components/ui/primitives";
import { getContent } from "@/lib/data";
import { localizeContent } from "@/lib/i18n/store/content";
import { getI18n } from "@/lib/i18n/store/server";
import type { FaqGroup } from "@/lib/types";
import { bogoLabel } from "@/lib/pricing";
import { faqLd } from "@/lib/seo";

/** Four questions from /admin → Content → FAQ (one per group first), all collapsed. */
function homeFaq(groups: FaqGroup[]) {
  // the Buy-N-Get-M answer is hidden while that offer is switched off (English or Arabic wording)
  const keep = (q: string) => !!bogoLabel() || !/buy \d+,? get \d+|اشتري\s*\d+/i.test(q);
  const groupsKept = groups.map((g) => g.items.filter((it) => keep(it.q)));
  const out: { q: string; a: string }[] = [];
  for (let round = 0; out.length < 4 && groupsKept.some((g) => g.length > round); round++)
    for (const g of groupsKept) if (g[round] && out.length < 4) out.push(g[round]);
  return out;
}

export async function HomeFaq() {
  const { d, locale } = await getI18n();
  const items = homeFaq(localizeContent(getContent(), locale).faq);
  if (!items.length) return null;
  return (
    <section className="container-x mt-16 md:mt-28" aria-labelledby="faq-h">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div className="flex items-end justify-between gap-4 lg:flex-col lg:items-start lg:justify-start">
          <h2 id="faq-h" className="text-poster">
            {d.home.faq.heading}
          </h2>
          <Link href="/pages/faq" className="tap -mb-1 inline-flex h-11 shrink-0 items-center gap-1 text-[14px] font-semibold underline-offset-4 hover:underline lg:mt-4">
            {d.home.faq.all} <Icon name="arrowUpRight" size={16} />
          </Link>
        </div>
        <div className="rounded-[28px] bg-surface px-5 py-1 md:px-10 md:py-4 [&>details:last-child]:border-b-0">
          {items.map((f) => (
            <Accordion key={f.q} title={f.q}>
              {f.a}
            </Accordion>
          ))}
        </div>
      </div>
      <JsonLd data={faqLd(items, locale)} />
    </section>
  );
}
