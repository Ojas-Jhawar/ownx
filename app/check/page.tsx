import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Eyebrow } from "@/components/ui-kit"
import { CheckForm } from "@/components/check/check-form"

export const metadata: Metadata = {
  title: "Check an item before you buy",
  description: "Look up an Ownx ID, serial number or IMEI to see if the owner reported it lost or stolen.",
}

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:py-20">
          <Eyebrow>Free · no account needed</Eyebrow>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Buying second-hand? Check it first.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground">
            See whether an owner has reported the device lost or stolen, and whether a manufacturer or approved seller registered it.
            We never show who owns it.
          </p>
          <div className="mt-10"><CheckForm /></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
