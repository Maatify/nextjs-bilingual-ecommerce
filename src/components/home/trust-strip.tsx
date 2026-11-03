import { Icon, type IconName } from "@/components/ui/icon";
import { getI18n } from "@/lib/i18n/store/server";

/** Three reassurances, icon + a few words each. */
export async function TrustStrip() {
  const { d } = await getI18n();
  const tr = d.home.trust;
  const ITEMS: { icon: IconName; label: string }[] = [
    { icon: "cash", label: tr.cod },
    { icon: "refresh", label: tr.exchange },
    { icon: "truck", label: tr.delivery },
  ];
  return (
    <section className="container-x mt-20 md:mt-32" aria-label={tr.label}>
      <ul className="grid grid-cols-3 gap-2 rounded-[28px] bg-surface p-5 md:p-10">
        {ITEMS.map((i) => (
          <li key={i.label} className="flex flex-col items-center gap-2.5 text-center md:flex-row md:justify-center md:gap-3 md:text-start">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-soft text-forest md:size-12">
              <Icon name={i.icon} size={20} />
            </span>
            <span className="text-[13px] font-semibold leading-snug md:text-[16px]">{i.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
