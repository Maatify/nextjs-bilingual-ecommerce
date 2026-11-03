import Link from "@/components/i18n/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Logo } from "@/components/layout/header";
import { Toaster, WhatsAppButton } from "@/components/layout/overlays";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/lib/i18n/store/server";
import { bogoLabel } from "@/lib/pricing";

/** Paid-traffic landing shell: no navigation leaks — logo, trust chip, policies only. */
export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const { d, locale } = await getI18n();
  const sh = d.layout.shell;
  const offer = bogoLabel(locale);
  return (
    <>
      <div className="bg-ink py-2.5 text-center font-poster text-[14px] tracking-wide text-white">
        {offer ? (
          <>
            {offer} <span aria-hidden>✱</span>{" "}
          </>
        ) : null}
        {d.common.cashOnDelivery}
      </div>
      <header className="bg-bg">
        <div className="container-x flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <span className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium">
              <Icon name="cash" size={16} /> {d.common.payOnDelivery}
            </span>
          </div>
        </div>
      </header>
      <main id="main" className="pb-28 md:pb-16">{children}</main>
      <footer className="container-x flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-line py-8 text-[13px] text-muted">
        {[
          [sh.shipping, "/pages/shipping"],
          [sh.returns, "/pages/returns"],
          [sh.privacy, "/pages/privacy"],
          [sh.terms, "/pages/terms"],
          [sh.contact, "/pages/contact"],
        ].map(([l, h]) => (
          <Link key={h} href={h} className="hover:text-ink">
            {l}
          </Link>
        ))}
      </footer>
      <WhatsAppButton />
      <Toaster />
    </>
  );
}
