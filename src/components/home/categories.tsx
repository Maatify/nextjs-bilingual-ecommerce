import Image from "next/image";
import Link from "@/components/i18n/link";
import { Tilt3D } from "@/components/fx/tilt";
import { Icon } from "@/components/ui/icon";
import { getCategoryCollections, productsIn } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n/store/server";
import type { I18n } from "@/lib/i18n/store/kit";

/** Category tiles = visible collections whose products all share one category (Hoodies, Tees…), not edits like Bestsellers. */
function getTiles(collection: I18n["collection"]) {
  return getCategoryCollections().map((c) => ({ label: collection(c).title, href: `/collections/${c.handle}`, src: c.image || productsIn(c.handle)[0].colors[0].images[0] }));
}

const circle = "relative grid size-[84px] place-items-center overflow-hidden rounded-full ring-1 transition duration-300 group-hover:ring-ink/30 md:size-[128px]";

/** Vestra-style round category tiles; scrolls sideways on mobile. */
export async function Categories() {
  const { d, collection } = await getI18n();
  const tiles = getTiles(collection);
  return (
    <section className="mt-6 md:mt-10" aria-labelledby="cat-h">
      <h2 id="cat-h" className="sr-only">
        {d.home.categories.heading}
      </h2>
      {/* stays a sideways scroller at every width: 9 round tiles (128px + gaps) need ~1340px, so `md:overflow-visible` made the whole
          page scroll horizontally on tablets / small laptops. py-2/-my-2 leaves room for the hover tilt-scale inside the scroller. */}
      <ul className="no-scrollbar container-x -my-2 flex snap-x scroll-px-(--gutter) gap-3 overflow-x-auto py-2 md:justify-between md:gap-6">
        {tiles.map((t) => (
          <li key={t.href} className="shrink-0 snap-start">
            <Link href={t.href} className="group flex flex-col items-center gap-2.5">
              <Tilt3D max={12} scale={1.04} className="rounded-full">
                <span className={`${circle} fx-sat bg-surface ring-line`}>
                  <Image src={t.src} alt="" fill sizes="(min-width: 768px) 128px, 84px" className="scale-[1.35] object-cover object-[50%_35%] transition-transform duration-500 group-hover:scale-[1.45]" />
                </span>
              </Tilt3D>
              <span className="text-[13px] font-semibold md:text-[15px]">{t.label}</span>
            </Link>
          </li>
        ))}
        <li className="shrink-0 snap-start">
          <Link href="/collections/all" className="group flex flex-col items-center gap-2.5">
            <span className={`${circle} fx-press bg-ink text-white ring-ink`}>
              <Icon name="arrowUpRight" size={26} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
            </span>
            <span className="text-[13px] font-semibold md:text-[15px]">{d.common.shopAll}</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
