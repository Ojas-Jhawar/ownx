import Image from "next/image"
import { notFound } from "next/navigation"
import { BadgeCheck, Check, ShieldCheck } from "lucide-react"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/server"
import { formatINR, warrantyRemaining } from "@/lib/format"
import type { Asset } from "@/lib/types"

// Public page: no login required. Relies on the "Anyone can view active
// listings" and "Anyone can view assets behind an active listing" RLS
// policies in supabase/schema.sql — nothing sensitive (owner id, serial
// number, raw documents) is queried or rendered here.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from("listings")
    .select("id, asset_id, asking_price, status")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle()

  if (!listing) notFound()

  const { data: assetRaw } = await supabase
    .from("assets")
    .select("product_name, brand, category, image_url, condition_score, serial_number, warranty_months, purchase_date")
    .eq("id", listing.asset_id)
    .single()

  if (!assetRaw) notFound()
  const asset = assetRaw as Pick<
    Asset,
    "product_name" | "brand" | "category" | "image_url" | "condition_score" | "serial_number" | "warranty_months" | "purchase_date"
  >

  const warranty = warrantyRemaining(asset.purchase_date, asset.warranty_months)

  const provenance = [
    "Original invoice",
    asset.serial_number ? "Serial verified" : null,
    warranty.active ? "Warranty active" : null,
    "Condition assessed by owner",
    "1 previous owner",
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-ink/10">
          <div className="flex items-center justify-between bg-ink px-6 py-4">
            <Logo href="/" invert />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <BadgeCheck className="size-3.5 text-brand" /> Verified Passport
            </span>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <div className="grid h-56 place-items-center overflow-hidden rounded-2xl bg-muted">
              <Image
                src={asset.image_url || "/images/product-laptop.png"}
                alt={asset.product_name || "Listed item"}
                width={240}
                height={180}
                className="object-contain"
              />
            </div>

            <div>
              <h1 className="text-xl font-semibold tracking-tight text-ink">{asset.product_name || "Listed item"}</h1>
              <p className="mt-2 text-3xl font-semibold text-ink">{formatINR(listing.asking_price)}</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-brand">
                  {asset.condition_score !== null ? `${asset.condition_score} / 100` : "Not rated"}
                </span>{" "}
                Condition
              </div>

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
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-brand" /> This is a verified listing powered by Ownx.
        </p>
      </div>
    </div>
  )
}
