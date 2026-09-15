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

// Creates a view-only share link for a passport (or returns the existing
// active one, so repeat clicks don't spawn duplicate links). Unlike a
// listing, this carries no price and isn't an offer to sell — it's just a
// verified, read-only view anyone with the link can open.
export async function createOrGetPassportShare(assetId: string): Promise<{ slug: string }> {
  const { supabase, user } = await requireUser()

  const { data: existing } = await supabase
    .from("passport_shares")
    .select("slug")
    .eq("asset_id", assetId)
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (existing) return { slug: existing.slug }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("product_name")
    .eq("id", assetId)
    .eq("owner_id", user.id)
    .single()

  if (assetError || !asset) throw new Error("Asset not found")

  const slug = randomSlug(asset.product_name || "passport")

  const { data, error } = await supabase
    .from("passport_shares")
    .insert({ asset_id: assetId, owner_id: user.id, slug, status: "active" })
    .select("slug")
    .single()

  if (error || !data) throw new Error(error?.message || "Could not create share link")

  revalidatePath(`/passport/${assetId}`)
  return { slug: data.slug }
}

export async function revokePassportShare(shareId: string, assetId: string) {
  const { supabase, user } = await requireUser()
  await supabase.from("passport_shares").update({ status: "revoked" }).eq("id", shareId).eq("owner_id", user.id)
  revalidatePath(`/passport/${assetId}`)
}
