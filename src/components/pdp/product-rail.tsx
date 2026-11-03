import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/lib/types";

/** Poster heading + horizontal snap rail on mobile, 4-up on desktop. */
export function ProductRail({ title, items }: { title: string; items: Product[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="rail-h">
      <h2 id="rail-h" className="mb-6 text-poster md:mb-10">
        {title}
      </h2>
      <ul className="no-scrollbar -mx-[var(--gutter)] flex snap-x snap-mandatory scroll-px-[var(--gutter)] gap-3 overflow-x-auto px-[var(--gutter)] pb-2 md:gap-5">
        {items.map((p) => (
          <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc(25%-15px)]">
            <ProductCard product={p} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 31vw, 46vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}
