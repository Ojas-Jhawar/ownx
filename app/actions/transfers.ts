"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

// Sends a transfer request to a recipient's email. Nothing changes hands yet
// — the recipient has to log in with that email and accept it from /transfers.
export async function initiateTransfer(assetId: string, formData: FormData) {
  const { supabase, user } = await requireUser()

  const toEmail = String(formData.get("to_email") || "").trim().toLowerCase()
  const note = String(formData.get("note") || "").trim()

  if (!toEmail || !toEmail.includes("@")) throw new Error("Enter a valid email address")
  if (toEmail === (user.email || "").toLowerCase()) throw new Error("You already own this passport")

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("owner_id", user.id)
    .single()
  if (assetError || !asset) throw new Error("Asset not found")

  const { data: pending } = await supabase
    .from("ownership_transfers")
    .select("id")
    .eq("asset_id", assetId)
    .eq("status", "pending")
    .maybeSingle()
  if (pending) throw new Error("There's already a pending transfer for this passport — cancel it first.")

  const { error } = await supabase.from("ownership_transfers").insert({
    asset_id: assetId,
    from_user_id: user.id,
    to_email: toEmail,
    note: note || null,
    status: "pending",
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/passport/${assetId}`)
  revalidatePath("/transfers")
}

export async function cancelTransfer(transferId: string, assetId: string) {
  const { supabase, user } = await requireUser()
  const { error } = await supabase
    .from("ownership_transfers")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("from_user_id", user.id)
  if (error) throw new Error(error.message)
  revalidatePath(`/passport/${assetId}`)
  revalidatePath("/transfers")
}

export async function declineTransfer(transferId: string) {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from("ownership_transfers")
    .update({ status: "declined", resolved_at: new Date().toISOString() })
    .eq("id", transferId)
  if (error) throw new Error(error.message)
  revalidatePath("/transfers")
}

// The only step that actually reassigns the passport — runs through the
// accept_ownership_transfer() Postgres function so it can verify the caller
// is logged in with the email the transfer was sent to.
export async function acceptTransfer(transferId: string) {
  const { supabase } = await requireUser()
  const { error } = await supabase.rpc("accept_ownership_transfer", { p_transfer_id: transferId })
  if (error) throw new Error(error.message)
  revalidatePath("/transfers")
  revalidatePath("/dashboard")
}
