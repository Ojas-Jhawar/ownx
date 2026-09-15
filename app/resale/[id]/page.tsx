import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { Check, X, ArrowRight } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { createListing } from "@/app/actions/listings"
import { formatINR } from "@/lib/format"
import { warrantyRemaining } from "@/lib/format"
import type { Asset } from "@/lib/types"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: assetRaw }, { data: docs }, { data: existingListing }, { data: profile }] = await Promise.all([
    supabase.from("assets").select("*").eq("id", id).eq("owner_id", user.id).single(),
    supabase.from("documents").select("id").eq("asset_id", id).eq("owner_id", user.id),
    supabase.from("listings").select("slug").eq("asset_id", id).eq("status", "active").maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ])

  if (!assetRaw) notFound()
  const asset = assetRaw as Asset
  const warranty = warrantyRemaining(asset.purchase_date, asset.warranty_months)

  if (existingListing) redirect(`/p/${existingListing.slug}`)

  const provenance = [
    { label: "Invoice on file", met: (docs?.length || 0) > 0 },
    { label: "Serial number verified", met: !!asset.serial_number },
    { label: "Warranty active", met: warranty.active },
    { label: "Condition assessed", met: asset.condition_score !== null },
    { label: "1 owner (this account)", met: true },
  ]

  const boundCreate = createListing.bind(null, asset.id)

  return (
    <AppShell active="Marketplace" userName={profile?.full_name || undefined} userEmail={user.email}>
      <div className="mx-auto max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Ready for its next owner?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Share verified history instead of asking buyers to take your word for it.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="grid h-40 place-items-center overflow-hidden rounded-xl bg-muted sm:w-48">
              <Image
                src={asset.image_url || "/images/product-laptop.png"}
                alt={asset.product_name || "Asset"}
                width={160}
                height={120}
                className="object-contain"
              />
            </div>
            <div>
              <p className="font-semibold text-ink">{asset.product_name || "Untitled asset"}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{formatINR(asset.purchase_price)}</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-brand">
                  {asset.condition_score !== null ? `${asset.condition_score} / 100` : "Not rated"}
                </span>{" "}
                Condition
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {provenance.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm text-ink-soft">
                    {item.met ? (
                      <Check className="size-4 shrink-0 text-brand" />
                    ) : (
                      <X className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <form action={boundCreate} className="mt-6 space-y-4">
          <div>
            <label htmlFor="asking_price" className="text-sm font-medium text-ink-soft">
              Asking price (₹)
            </label>
            <input
              id="asking_price"
              name="asking_price"
              type="number"
              defaultValue={asset.purchase_price ? Math.round(asset.purchase_price * 0.6) : ""}
              className="mt-1.5 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5"
          >
            Generate Verified Listing <ArrowRight className="size-4" />
          </button>
        </form>
      </div>
    </AppShell>
  )
}
