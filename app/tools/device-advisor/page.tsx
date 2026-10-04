import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Eyebrow } from "@/components/ui-kit"
import { DeviceAdvisor } from "@/components/tools/device-advisor"
import { PageWithAdRail } from "@/components/ads/page-with-ad-rail"
import { MobileAdBanner } from "@/components/ads/mobile-ad-banner"

// Public — no login required. One tool answering both "what's it worth" and
// "should I repair, replace, or sell it" instead of two separate forms.
export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <Eyebrow>Free tool · no account needed</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Repair it, sell it, or scrap it?
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Get a materials-based scrap/recycle value — battery, screen, copper, aluminium, gold-plated
            connectors, the lot — alongside a straight answer on whether to keep using it, repair it, replace it,
            or sell it 2nd-hand.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <PageWithAdRail adSlot="device-advisor">
            <DeviceAdvisor />
          </PageWithAdRail>
        </section>
      </main>
      <SiteFooter />
      <MobileAdBanner adSlot="device-advisor-mobile" />
    </div>
  )
}
