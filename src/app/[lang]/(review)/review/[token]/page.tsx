import "@/server/boot";
import type { Metadata } from "next";
import { ReviewLinkForm, type ReviewLinkItem } from "@/components/reviews/review-link-form";
import { ButtonLink } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { asLocale } from "@/lib/i18n/store/config";
import { getDict, getI18n } from "@/lib/i18n/store/server";
import { resolveReviewToken, reviewableLines } from "@/server/review-requests";
import { getProduct, getReviewSettings } from "@/server/store";

// personal, per-customer page: never cached, never indexed, and the token never leaks through the Referer header
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/review/[token]">): Promise<Metadata> {
  const locale = asLocale((await params).lang);
  return { title: getDict(locale).review.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ReviewLinkPage({ params }: PageProps<"/[lang]/review/[token]">) {
  const { token } = await params;
  const { d, t, money, product: localize, color } = await getI18n();
  const R = d.review;
  const res = resolveReviewToken(decodeURIComponent(token));

  if (!res.ok) {
    const [title, body] = res.reason === "used" ? [R.usedTitle, R.usedBody] : res.reason === "expired" ? [R.expiredTitle, R.expiredBody] : [R.invalidTitle, R.invalidBody];
    return (
      <div className="container-x flex max-w-[640px] flex-col items-center py-16 text-center md:py-24">
        <span className="grid size-14 place-items-center rounded-full bg-surface" aria-hidden>
          <Icon name={res.reason === "used" ? "check" : "info"} size={24} />
        </span>
        <h1 className="mt-5 text-h2">{title}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{body}</p>
        <ButtonLink href="/collections/all" className="mt-8">
          {R.keepShopping}
        </ButtonLink>
      </div>
    );
  }

  const { order } = res;
  const items: ReviewLinkItem[] = reviewableLines(order).map((l, key) => {
    const p = getProduct(l.productId);
    const lp = p ? localize(p) : null;
    return { key, title: lp?.title ?? l.title, image: l.image, color: color(p, l.color), size: l.size, apparel: (p?.sizeChart ?? "tops") !== "onesize", handle: p?.handle ?? l.handle };
  });
  const s = getReviewSettings();
  const reward = s.reward.enabled && s.reward.value > 0 ? (s.reward.kind === "pct" ? `${s.reward.value}%` : money(s.reward.value)) : null;
  const first = order.customer.name.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="container-x max-w-[760px] pb-20 pt-8 md:pt-14">
      <p className="text-[13px] font-semibold text-muted">{t(R.eyebrow, { number: order.number })}</p>
      <h1 className="mt-2 text-poster">{t(R.title, { name: first })}</h1>
      <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-ink-2">{R.intro}</p>
      {reward ? (
        <div className="mt-5 flex items-start gap-3 rounded-[20px] bg-sage-soft p-4 text-[14px] leading-relaxed text-ink">
          <Icon name="gift" size={20} className="mt-0.5 shrink-0 text-forest" />
          <p>
            {t(s.reward.photoRequired ? R.rewardPhoto : R.reward, { reward })}
            <span className="mt-1 block text-[13px] text-ink-2">{R.rewardNote}</span>
          </p>
        </div>
      ) : null}
      <ReviewLinkForm token={decodeURIComponent(token)} items={items} defaultName={order.customer.name} defaultCity={order.address.city} reward={!!reward} />
    </div>
  );
}
