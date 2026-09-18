import Image from "next/image"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import QRCode from "qrcode"
import { ShieldCheck, Store, ArrowRight } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { Pill } from "@/components/ui-kit"
import { PassportTabs } from "@/components/passport/passport-tabs"
import { PassportShareButton } from "@/components/passport/share-button"
import { createClient } from "@/lib/supabase/server"
import type { Asset, DocumentRow, ServiceRecord, OwnershipTransfer } from "@/lib/types"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: assetRaw },
    { data: docsRaw },
    { data: recordsRaw },
    { data: listing },
    { data: profile },
    { data: shareRaw },
    { data: pendingTransferRaw },
    { data: pastTransfersRaw },
  ] = await Promise.all([
    supabase.from("assets").select("*").eq("id", id).eq("owner_id", user.id).single(),
    supabase.from("documents").select("*").eq("asset_id", id).eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("service_records").select("*").eq("asset_id", id).eq("owner_id", user.id).order("serviced_at", { ascending: false }),
    supabase.from("listings").select("slug").eq("asset_id", id).eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("passport_shares").select("*").eq("asset_id", id).eq("owner_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("ownership_transfers").select("*").eq("asset_id", id).eq("from_user_id", user.id).eq("status", "pending").maybeSingle(),
    supabase.from("ownership_transfers").select("*").eq("asset_id", id).eq("status", "accepted").order("resolved_at", { ascending: true }),
  ])

  if (!assetRaw) notFound()
  const asset = assetRaw as Asset

  const documents = await Promise.all(
    ((docsRaw as DocumentRow[]) || []).map(async (d) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 3600)
      return { id: d.id, file_name: d.file_name, kind: d.kind, url: signed?.signedUrl ?? null, created_at: d.created_at }
    }),
  )

    const { data: deviceRaw } = await supabase
    .from("devices")
    .select("id, ownx_id, product_name, manufactured_at, warranty_months, status, organizations:manufacturer_org_id ( name )")
    .eq("asset_id", id)
    .maybeSingle()

  const { data: timelineRaw } = deviceRaw
    ? await supabase
        .from("lifecycle_events")
        .select("*, organizations:actor_org_id ( name )")
        .eq("device_id", (deviceRaw as any).id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] }

  // Resolve display names for everyone who has ever held this passport.
  const pastTransfers = (pastTransfersRaw as OwnershipTransfer[]) || []
  const chainUserIds = Array.from(new Set(pastTransfers.flatMap((t) => [t.from_user_id, t.to_user_id]).filter(Boolean))) as string[]
  const { data: chainProfiles } = chainUserIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", chainUserIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
  const nameById = new Map((chainProfiles || []).map((p) => [p.id, p.full_name || p.email || "Unknown"]))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  const listingShareUrl = listing ? `${siteUrl}/p/${listing.slug}` : null
  const passportShareUrl = shareRaw ? `${siteUrl}/share/${shareRaw.slug}` : null
  const primaryShareUrl = listingShareUrl || passportShareUrl

  const qrDataUrl = primaryShareUrl ? await QRCode.toDataURL(primaryShareUrl, { margin: 1, width: 160 }) : null

  const ownerName = profile?.full_name || user.email || "You"

  return (
    <AppShell active="Overview" userName={profile?.full_name || undefined} userEmail={user.email}>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{asset.product_name || "Untitled asset"}</h1>
            <Pill>
              <ShieldCheck className="size-3.5" /> Verified
            </Pill>
          </div>
	  <div className="flex gap-2">
            {deviceRaw && (
              <Pill tone="neutral">
                <span className="font-mono">{(deviceRaw as any).ownx_id}</span>
              </Pill>
            )}
            <PassportShareButton assetId={asset.id} existingUrl={passportShareUrl} siteUrl={siteUrl} />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-3xl border border-border bg-ink p-6 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-widest text-white/50">Ownership Passport</span>
              <ShieldCheck className="size-5 text-brand" />
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl bg-white/5">
              <div className="relative aspect-[4/3]">
                <Image
                  src={asset.image_url || "/images/product-laptop.png"}
                  alt={asset.product_name || "Asset"}
                  fill
                  className="object-contain p-6"
                />
              </div>
            </div>
            <p className="mt-4 text-lg font-semibold">{asset.product_name || "Untitled asset"}</p>
            <p className="text-sm text-white/60">{[asset.brand, asset.category].filter(Boolean).join(" · ") || "—"}</p>

            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Passport QR code" className="size-10 rounded" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded bg-white/10 text-[10px] text-white/50">
                  no link
                </span>
              )}
              <div className="text-xs text-white/60">
                <p className="font-medium text-white">
                  {listingShareUrl ? "Verified Listing" : passportShareUrl ? "Shared Passport" : "Not shared yet"}
                </p>
                <p className="truncate">
                  {primaryShareUrl ? primaryShareUrl.replace(/^https?:\/\//, "") : "Share your passport to get a QR code"}
                </p>
              </div>
            </div>
          </div>

          <div>
                        <PassportTabs
              asset={asset}
              documents={documents}
              serviceRecords={(recordsRaw as ServiceRecord[]) || []}
              ownerName={ownerName}
              pendingTransfer={pendingTransferRaw as OwnershipTransfer | null}
              ownershipChain={pastTransfers.map((t) => ({
                id: t.id,
                fromName: nameById.get(t.from_user_id) || "Unknown",
                toName: t.to_user_id ? nameById.get(t.to_user_id) || "Unknown" : t.to_email,
                resolvedAt: t.resolved_at,
              }))}
              passportShare={shareRaw ? { id: shareRaw.id, slug: shareRaw.slug, url: passportShareUrl! } : null}
              device={deviceRaw as any}
              timeline={(timelineRaw as any[]) || []}
            />

            <div className="mt-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-semibold text-ink">Ready to sell?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Turn this passport into a shareable, verified resale listing.
              </p>
              <Link
                href={`/resale/${asset.id}`}
                className="mt-4 inline-flex w-full items-center justify-between gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Store className="size-4" /> Generate Resale Listing
                </span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
