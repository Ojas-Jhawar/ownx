"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

export async function reportLostStolen(assetId: string, fd: FormData) {
  const { supabase, user } = await requireUser()
  const kind = fd.get("kind") === "stolen" ? "stolen" : "lost"
  const details = String(fd.get("details") || "").trim().slice(0, 500) || null

  const { error } = await supabase.from("lost_reports").insert({ asset_id: assetId, owner_id: user.id, kind, details })
  if (error) {
    if (error.code === "23505") throw new Error("This item already has an open report.")
    throw new Error(error.message)
  }

  // Stop anything that could move or advertise the item.
  await supabase.from("passport_shares").update({ status: "revoked" }).eq("asset_id", assetId).eq("owner_id", user.id).eq("status", "active")
  await supabase.from("listings").update({ status: "withdrawn" }).eq("asset_id", assetId).eq("owner_id", user.id).eq("status", "active")
  await supabase.from("ownership_transfers").update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("asset_id", assetId).eq("from_user_id", user.id).eq("status", "pending")

  revalidatePath(`/passport/${assetId}`)
}

export async function resolveReport(reportId: string, assetId: string) {
  const { supabase, user } = await requireUser()
  const { error } = await supabase.from("lost_reports")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", reportId).eq("owner_id", user.id)
  if (error) throw new Error(error.message)
  revalidatePath(`/passport/${assetId}`)
}
