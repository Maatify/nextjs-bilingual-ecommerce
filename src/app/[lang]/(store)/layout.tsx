import { CartDrawer } from "@/components/cart/cart-drawer";
import { FxRuntime } from "@/components/fx/runtime";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SocialProof, SocialRail, Toaster, WelcomeOffer, WhatsAppButton } from "@/components/layout/overlays";
import { SearchOverlay } from "@/components/layout/search-overlay";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* mounted once here (not in the template) so its listeners aren't torn down on every navigation */}
      <FxRuntime />
      <AnnouncementBar />
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <MobileTabBar />
      <CartDrawer />
      <SearchOverlay />
      <Toaster />
      <SocialProof />
      <WhatsAppButton docked />
      <SocialRail />
      <WelcomeOffer />
    </>
  );
}
