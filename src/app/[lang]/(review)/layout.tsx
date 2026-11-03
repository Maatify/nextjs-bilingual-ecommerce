import { Logo } from "@/components/layout/header";
import { Toaster } from "@/components/layout/overlays";

/** Personal review link shell: just the logo — no nav, popups or upsells while the customer writes. */
export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl">
        <div className="container-x flex h-16 items-center justify-center">
          <Logo />
        </div>
      </header>
      <main id="main">{children}</main>
      <Toaster />
    </>
  );
}
