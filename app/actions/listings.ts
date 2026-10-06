"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { randomSlug } from "@/lib/utils"
import { RESALE_ENABLED } from "@/lib/features"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

export async function createListing(assetId: string, formData: FormData) {
  // Server-side gate: hiding the UI is not enough, the action is callable directly.
  if (!RESALE_ENABLED) throw new Error("Resale is not available yet.")

  const { supabase, user } = await requireUser()

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("product_name")
    .eq("id", assetId)
    .eq("owner_id", user.id)
    .single()

  if (assetError || !asset) throw new Error("Asset not found")

  const rawPrice = formData.get("asking_price")
  const askingPrice = rawPrice ? Number(rawPrice) : null
  if (askingPrice !== null && (!Number.isFinite(askingPrice) || askingPrice < 0)) {
    throw new Error("Enter a valid asking price")
  }

  const slug = randomSlug(asset.product_name || "asset")

  const { error } = await supabase.from("listings").insert({
    asset_id: assetId,
    owner_id: user.id,
    slug,
    asking_price: askingPrice,
    status: "active",
  })

  if (error) throw new Error(error.message)

  revalidatePath("/marketplace")
  revalidatePath(`/passport/${assetId}`)
  redirect(`/p/${slug}`)
}

// Withdrawing stays available even while resale is paused, so owners can take down old listings.
export async function withdrawListing(listingId: string, assetId: string) {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from("listings")
    .update({ status: "withdrawn" })
    .eq("id", listingId)
    .eq("owner_id", user.id)
  if (error) throw new Error(error.message)
  revalidatePath("/marketplace")
  revalidatePath(`/passport/${assetId}`)
}
