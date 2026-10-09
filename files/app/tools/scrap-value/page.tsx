import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Eyebrow } from "@/components/ui-kit"
import { ScrapCalculator } from "@/components/tools/scrap-calculator"
import { PageWithAdRail } from "@/components/ads/page-with-ad-rail"
import { MobileAdBanner } from "@/components/ads/mobile-ad-banner"
import { createClient } from "@/lib/supabase/server"
import { loadScrapProfiles } from "@/lib/scrap-rates-db"
import { SCRAP_PROFILES, type ScrapCategory } from "@/lib/scrap-rates"
import { normalizeCategory } from "@/lib/diagnose-questions"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = {
  title: "Scrap value calculator: what is your old laptop or phone worth?",
  description: "Free estimate of the scrap and recycling value of old electronics in India, by material: aluminium, copper, battery, glass and gold plating.",
  alternates: { canonical: "/tools/scrap-value" },
}

type SP = Record<string, string | undefined>

// Public, no login. Accepts either shared-link params (category, weight, condition, date, price)
// or the passport button's params (cat = free-text category).
export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { profiles, updatedAt } = await loadScrapProfiles(supabase)

  const category = (
    sp.category && sp.category in SCRAP_PROFILES ? sp.category : sp.cat ? normalizeCategory(sp.cat) : "laptop"
  ) as ScrapCategory
  const cond = Number(sp.condition)
  const condition = Number.isFinite(cond) && sp.condition ? String(Math.min(100, Math.max(0, cond))) : "60"

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <Eyebrow>Free tool · no account needed</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            What is your old device worth as scrap?
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            A material-by-material estimate for laptops, phones, audio gear and appliances. Not sure whether to repair, sell or scrap?{" "}
            <Link href="/tools/device-advisor" className="font-medium text-brand hover:underline">Try the device advisor</Link>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Rates {updatedAt ? `last updated ${formatDate(updatedAt)}` : "are built-in defaults"}. Indicative only, always confirm with an authorised recycler.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-12">
          <PageWithAdRail adSlot="scrap-value">
            <ScrapCalculator
              profiles={profiles}
              defaults={{
                category,
                weightKg: sp.weight && Number(sp.weight) > 0 ? sp.weight : "",
                condition,
                purchaseDate: sp.date || "",
                purchasePrice: sp.price && Number(sp.price) > 0 ? sp.price : "",
              }}
            />
          </PageWithAdRail>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold text-ink">Where to recycle</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Use a recycler authorised by the Central Pollution Control Board, or the brand&apos;s own take-back programme.</li>
              <li>Back up and factory reset the device before handing it over.</li>
              <li>Ask for a receipt or recycling certificate, and log it in your passport.</li>
            </ul>
            <Link href="/blog/e-waste-india-where-to-recycle" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
              Read: E-waste in India, where to recycle
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <MobileAdBanner adSlot="scrap-value-mobile" />
    </div>
  )
}
