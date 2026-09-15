import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ShoppingCart, Store, ShieldCheck } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Pill } from "@/components/ui-kit"
import { createClient } from "@/lib/supabase/server"
import { formatINR } from "@/lib/format"

const REASONS = [
  { icon: ShoppingCart, title: "Buyers", copy: "Know what you're buying." },
  { icon: Store, title: "Sellers", copy: "Build trust before the first message." },
  { icon: ShieldCheck, title: "Ownx", copy: "Preserve the asset's history." },
]

export default async function Page() {
  const supabase = await createClient()

  const { data: listings } = await supabase
    .from("listings")
    .select("slug, asking_price, asset_id, assets ( product_name, image_url, condition_score )")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(12)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="rounded-3xl bg-brand-soft/70 p-8 text-center sm:p-12">
            <Pill>Verified Resale</Pill>
            <h1 className="mx-auto mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              The passport — not the seller&apos;s description — is the source of truth.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Every listing below is backed by a real Ownership Passport: verified invoice, condition, and history.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-8">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Live listings</h2>

          {!listings || listings.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">No listings yet — be the first to list a verified asset.</p>
              <Link href="/dashboard" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                Go to your dashboard <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l: any) => (
                <div key={l.slug} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="relative aspect-[4/3] bg-muted">
                    <Image
                      src={l.assets?.image_url || "/images/product-laptop.png"}
                      alt={l.assets?.product_name || "Listed item"}
                      fill
                      className="object-contain p-6"
                    />
                    <span className="absolute left-3 top-3">
                      <Pill>Verified</Pill>
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-ink">{l.assets?.product_name || "Listed item"}</h3>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-lg font-semibold text-ink">{formatINR(l.asking_price)}</span>
                      <span className="text-sm text-brand">
                        {l.assets?.condition_score !== null ? `${l.assets?.condition_score}/100` : "—"}
                      </span>
                    </div>
                    <Link
                      href={`/p/${l.slug}`}
                      className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-medium text-ink transition-colors hover:bg-muted"
                    >
                      View Passport <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Why verified resale?</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {REASONS.map((r) => (
              <div key={r.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <r.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{r.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.copy}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
