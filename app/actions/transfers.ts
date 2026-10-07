"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { sendEmail, esc } from "@/lib/email"

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

  // FIX: this used to fire the `lifecycle_events` insert (using a
  // `linkedDevice` lookup) BEFORE checking whether the `ownership_transfers`
  // insert below had even succeeded — `error` was only checked several
  // lines later. That meant a failed transfer could still log a lifecycle
  // event claiming a transfer was initiated, and a successful transfer's
  // real error (if any) was silently ignored until after other work had
  // already run. Insert the transfer first, check its error immediately,
  // and only then do the (non-critical) lifecycle logging.
  const { error } = await supabase.from("ownership_transfers").insert({
    asset_id: assetId,
    from_user_id: user.id,
    to_email: toEmail,
    note: note || null,
    status: "pending",
  })
  if (error) throw new Error(error.message)
  await sendEmail({
      to: toEmail,
      subject: "Someone sent you an Ownx passport",
      html: `<p>${esc(user.email || "An Ownx user")} sent you a passport.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/transfers">Review the transfer</a></p>`,
})
  const { data: linkedDevice } = await supabase.from("devices").select("id").eq("asset_id", assetId).maybeSingle()
  if (linkedDevice) {
    const { error: lifecycleError } = await supabase.from("lifecycle_events").insert({
      device_id: linkedDevice.id,
      event_type: "ownership_transfer_initiated",
      status: "documented",
      actor_user_id: user.id,
      title: "Ownership transfer initiated",
      detail: `Owner started a transfer to ${toEmail}.`,
    })
    if (lifecycleError) {
      // Non-fatal: the transfer itself already succeeded and is the source
      // of truth for what happens next. Missing a timeline note shouldn't
      // block the person from sending their passport.
      console.error("Failed to log ownership_transfer_initiated lifecycle event:", lifecycleError.message)
    }
  }

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
