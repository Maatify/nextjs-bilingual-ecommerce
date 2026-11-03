import Link from "@/components/i18n/link";
import { Logo } from "@/components/layout/header";
import { Toaster } from "@/components/layout/overlays";
import { Icon } from "@/components/ui/icon";
import { getI18n } from "@/lib/i18n/store/server";

/** Distraction-free checkout shell: no nav, no popups, no footer links beyond policies. */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const { d } = await getI18n();
  return (
    <>
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl">
        <div className="container-x grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Link href="/cart" className="tap flex h-11 items-center gap-1.5 justify-self-start rounded-full bg-surface px-4 text-[14px] font-medium transition hover:bg-surface-2">
            <Icon name="arrowLeft" size={16} />
            {d.common.bag}
          </Link>
          <Logo />
          <span className="flex items-center gap-1.5 justify-self-end text-[14px] font-medium text-ink-2">
            <Icon name="lock" size={16} />
            <span className="hidden sm:inline">{d.layout.shell.secureCheckout}</span>
          </span>
        </div>
      </header>
      <main id="main">{children}</main>
      <Toaster />
    </>
  );
}
