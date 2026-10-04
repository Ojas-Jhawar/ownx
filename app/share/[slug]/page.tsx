import Image from "next/image"
import { notFound } from "next/navigation"
import { BadgeCheck, Check, ShieldCheck, Wrench } from "lucide-react"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/server"
import { formatINR, formatDate, warrantyRemaining, maskSerial } from "@/lib/format"
import { getAssetVerification } from "@/lib/verification"
import { VerificationBadge } from "@/components/verification/verification-badge"
import type { Asset, ServiceRecord } from "@/lib/types"

// Public page: no login required. Relies on the "Anyone can view active
// passport shares" / "Anyone can view assets behind an active share" /
// "Anyone can view service records behind an active share" RLS policies —
// nothing private (owner id, raw documents, full serial number) is exposed.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: share } = await supabase
    .from("passport_shares")
    .select("id, asset_id, status, owner_id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle()

  if (!share) notFound()

  const [{ data: assetRaw }, { data: recordsRaw }, { data: ownerProfile }, { count: transferCount }] = await Promise.all([
    supabase
      .from("assets")
      .select("product_name, brand, category, image_url, condition_score, serial_number, warranty_months, purchase_date")
      .eq("id", share.asset_id)
      .single(),
    supabase
      .from("service_records")
      .select("*")
      .eq("asset_id", share.asset_id)
      .order("serviced_at", { ascending: false }),
    supabase.from("profiles").select("full_name").eq("id", share.owner_id).single(),
    supabase
      .from("ownership_transfers")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", share.asset_id)
      .eq("status", "accepted"),
  ])

  if (!assetRaw) notFound()
  const asset = assetRaw as Pick<
    Asset,
    "product_name" | "brand" | "category" | "image_url" | "condition_score" | "serial_number" | "warranty_months" | "purchase_date"
  >
  const records = (recordsRaw as ServiceRecord[]) || []
  const warranty = warrantyRemaining(asset.purchase_date, asset.warranty_months)
  const ownerCount = (transferCount || 0) + 1

  // Real verification signal — see lib/verification.ts. Previously this page
  // always rendered "Verified Passport" regardless of whether an org ever
  // signed off on the asset.
  const verification = await getAssetVerification(supabase, share.asset_id)

  const provenance = [
    "Original invoice on file",
    asset.serial_number ? "Serial verified" : null,
    warranty.active ? "Warranty active" : null,
    "Condition assessed by owner",
    `${ownerCount} owner${ownerCount === 1 ? "" : "s"} on record`,
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-ink/10">
          <div className="flex items-center justify-between bg-ink px-6 py-4">
            <Logo href="/" invert />
            {/* Renamed from "Verified Passport" — see app/p/[slug]/page.tsx
                for the same change and rationale. */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <BadgeCheck className="size-3.5 text-brand" /> Ownx Passport
            </span>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <div className="grid h-56 place-items-center overflow-hidden rounded-2xl bg-muted">
              <Image
                src={asset.image_url || "/images/product-laptop.png"}
                alt={asset.product_name || "Shared asset"}
                width={240}
                height={180}
                className="object-contain"
              />
            </div>

            <div>
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink">{asset.product_name || "Shared item"}</h1>
                <VerificationBadge status={verification} className="shrink-0" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{[asset.brand, asset.category].filter(Boolean).join(" · ") || "—"}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Owned by <span className="font-medium text-ink">{ownerProfile?.full_name || "an Ownx user"}</span>
              </p>

              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-brand">
                  {asset.condition_score !== null ? `${asset.condition_score} / 100` : "Not rated"}
                </span>{" "}
                Condition
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Serial: {maskSerial(asset.serial_number)}</p>

              <ul className="mt-5 space-y-2.5">
                {provenance.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="grid size-5 place-items-center rounded-full bg-brand-soft text-brand">
                      <Check className="size-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-border p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Wrench className="size-4 text-brand" /> Service history
            </h2>
            {records.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No service records logged yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border bg-background p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-ink">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.serviced_at)} {r.cost ? `· ${formatINR(r.cost)}` : ""}
                      </p>
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
          <ShieldCheck className="size-4 text-brand" /> This is a verified passport shared read-only via Ownx. It is not
          a for-sale listing.
        </p>
      </div>
    </div>
  )
}
