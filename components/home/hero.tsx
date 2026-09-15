import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { Eyebrow } from "@/components/ui-kit"
import { PassportCard } from "@/components/passport-card"

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div>
          <Eyebrow>The Ownership Passport</Eyebrow>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            The Ownership Passport for Physical Assets.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            Ownx creates a verified digital record for everything you own — from the original invoice and warranty to
            service history, condition and resale.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-brand-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Create Passport <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-muted"
            >
              See How It Works
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            No paperwork. No lost receipts. No guessing.
          </p>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-muted shadow-lg">
            <Image
              src="/images/hero-desk.png"
              alt="A laptop and plant on a bright minimal desk"
              width={720}
              height={560}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <PassportCard className="absolute -bottom-6 -left-2 hidden sm:block sm:-left-6 lg:-left-10" />
        </div>
      </div>
    </section>
  )
}
