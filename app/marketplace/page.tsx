import Link from "next/link"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Pill } from "@/components/ui-kit"
import { RESALE_ENABLED } from "@/lib/features"
import { WaitlistForm } from "@/components/marketplace/waitlist-form"
import { MarketplaceLive } from "@/components/marketplace/marketplace-live"

export const metadata: Metadata = {
  title: "Marketplace, coming soon · Ownx",
  description: "Resale backed by real ownership history is on the way. Join the waitlist.",
}

export default function Page() {
  if (RESALE_ENABLED) return <MarketplaceLive />

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center">
        <section className="mx-auto max-w-2xl px-5 py-20 text-center">
          <Pill>Coming soon</Pill>
          <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Resale backed by real history is on the way.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-muted-foreground">
            We&apos;re building the Ownx marketplace so buyers can see what they&apos;re buying. Until then, create a
            passport and start building the record that will make your device worth more.
          </p>
          <WaitlistForm />
          <Link href="/create" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">
            Create your passport
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
