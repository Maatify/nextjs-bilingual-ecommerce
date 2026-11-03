import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/lib/i18n/store/server";
import { getSite } from "@/lib/site";
import type { Question } from "@/lib/types";

/** Q&A collapsed behind one disclosure; each answer is its own collapsed row. Server-rendered and crawlable. */
export async function Questions({ questions, productTitle }: { questions: Question[]; productTitle: string }) {
  if (!questions.length) return null;
  const { d, t } = await getI18n();
  const T = d.product.questions;
  return (
    <section id="questions" aria-label={T.label} className="scroll-mt-24">
      <details className="group/qa rounded-[24px] bg-surface px-5 md:px-8">
        <summary className="tap flex cursor-pointer list-none items-center gap-3 py-5 [&::-webkit-details-marker]:hidden">
          <span className="flex-1 text-[16px] font-semibold">
            {T.title} <span className="font-normal text-muted tabular-nums">({questions.length})</span>
          </span>
          <Icon name="plus" size={18} className="transition-transform duration-300 group-open/qa:rotate-45" />
        </summary>
        <ul className="border-t border-line">
          {questions.map((item) => (
            <li key={item.q} className="border-b border-line last:border-0">
              <details className="group/q">
                <summary className="tap flex cursor-pointer list-none items-center gap-3 py-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{item.q}</span>
                  <Icon name="chevronDown" size={16} className="shrink-0 text-muted transition-transform duration-300 group-open/q:rotate-180" />
                </summary>
                <p className="pb-4 text-[15px] leading-relaxed text-ink-2">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
        <a
          href={`https://wa.me/${getSite().whatsapp}?text=${encodeURIComponent(t(T.waText, { title: productTitle }))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tap mb-5 mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-semibold transition hover:bg-ink hover:text-white"
        >
          <Icon name="whatsapp" size={17} /> {T.ask}
        </a>
      </details>
    </section>
  );
}
