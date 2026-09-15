"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { randomSlug } from "@/lib/utils"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

export async function createListing(assetId: string, formData: FormData) {
  const { supabase, user } = await requireUser()

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("product_name")
    .eq("id", assetId)
    .eq("owner_id", user.id)
    .single()

  if (assetError || !asset) throw new Error("Asset not found")

  const askingPrice = formData.get("asking_price")
  const slug = randomSlug(asset.product_name || "asset")

  const { error } = await supabase.from("listings").insert({
    asset_id: assetId,
    owner_id: user.id,
    slug,
    asking_price: askingPrice ? Number(askingPrice) : null,
    status: "active",
  })

  if (error) throw new Error(error.message)

  revalidatePath("/marketplace")
  revalidatePath(`/passport/${assetId}`)
  redirect(`/p/${slug}`)
}

export async function withdrawListing(listingId: string, assetId: string) {
  const { supabase, user } = await requireUser()
  await supabase.from("listings").update({ status: "withdrawn" }).eq("id", listingId).eq("owner_id", user.id)
  revalidatePath("/marketplace")
  revalidatePath(`/passport/${assetId}`)
}
