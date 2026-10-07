import Image from "next/image"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BadgeCheck, Check, ShieldCheck, Wrench } from "lucide-react"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/server"
import { formatINR, formatDate, warrantyRemaining } from "@/lib/format"
import { VerificationBadge } from "@/components/verification/verification-badge"
import type { VerificationStatus } from "@/lib/verification"

// Bearer-token page: keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Shared = {
  asset: {
    product_name: string | null; brand: string | null; category: string | null; image_url: string | null
    condition_score: number | null; warranty_months: number | null; purchase_date: string | null; serial_masked: string | null
  }
  owner_name: string | null
  owner_count: number
  verification: VerificationStatus
  records: { id: string; title: string; notes: string | null; cost: number | null; performed_by: string | null; serviced_at: string }[]
}

// Data comes from get_shared_passport() (migration 013). The old public RLS policies are
// gone, so an anonymous caller can no longer list share slugs or read assets directly.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc("get_shared_passport", { p_slug: slug })
  if (!data) notFound()

  const { asset, owner_name, owner_count, verification, records } = data as Shared
  const warranty = warrantyRemaining(asset.purchase_date, asset.warranty_months)

  const provenance = [
    asset.serial_masked ? "Serial number on record" : null,
    warranty.active ? "Warranty active" : null,
    asset.condition_score !== null ? "Condition reported by owner" : null,
    `${owner_count} owner${owner_count === 1 ? "" : "s"} on record`,
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-ink/10">
          <div className="flex items-center justify-between bg-ink px-6 py-4">
            <Logo href="/" invert />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <BadgeCheck className="size-3.5 text-brand" /> Ownx Passport
            </span>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <div className="grid h-56 place-items-center overflow-hidden rounded-2xl bg-muted">
              <Image src={asset.image_url || "/images/product-laptop.png"} alt={asset.product_name || "Shared asset"} width={240} height={180} className="object-contain" />
            </div>
            <div>
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink">{asset.product_name || "Shared item"}</h1>
                <VerificationBadge status={verification} className="shrink-0" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{[asset.brand, asset.category].filter(Boolean).join(" · ") || "—"}</p>
              <p className="mt-3 text-sm text-muted-foreground">Owned by <span className="font-medium text-ink">{owner_name || "an Ownx user"}</span></p>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-brand">{asset.condition_score !== null ? `${asset.condition_score} / 100` : "Not rated"}</span> condition (owner-reported)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Serial: {asset.serial_masked || "—"}</p>
              <ul className="mt-5 space-y-2.5">
                {provenance.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="grid size-5 place-items-center rounded-full bg-brand-soft text-brand"><Check className="size-3" /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-border p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Wrench className="size-4 text-brand" /> Service history</h2>
            {records.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No service records logged yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border bg-background p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-ink">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.serviced_at)} {r.cost ? `· ${formatINR(r.cost)}` : ""}</p>
                    </div>
                    {r.performed_by && <p className="mt-0.5 text-xs text-muted-foreground">by {r.performed_by}</p>}
                    {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-brand" />
          {verification === "verified"
            ? "Registered by a manufacturer or approved seller. Shared read-only, not a for-sale listing."
            : "Details were entered by the owner and are not verified by Ownx. Shared read-only, not a for-sale listing."}
        </p>
      </div>
    </div>
  )
}
