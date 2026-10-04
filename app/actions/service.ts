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

// The receipt file (if any) is uploaded client-side to Storage first — same
// pattern as the invoice upload — and this receives the resulting path so it
// can index it as a document and link it to the service record.
export async function addServiceRecord(formData: FormData) {
  const { supabase, user } = await requireUser()

  const assetId = String(formData.get("asset_id") || "")
  const title = String(formData.get("title") || "").trim()

  if (!assetId || !title) throw new Error("Asset and title are required")

  // IMPORTANT: verify the asset actually belongs to this user before
  // attaching anything to it. RLS's insert policy on service_records now
  // also enforces this (see supabase/migrations/007_fix_ownership_checks.sql),
  // but this app-level check gives a clear error instead of an opaque RLS
  // failure, and doesn't leave this action relying on the database alone to
  // stop someone from passing an arbitrary asset_id that isn't theirs.
  const { data: ownedAsset, error: assetError } = await supabase
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("owner_id", user.id)
    .maybeSingle()
  if (assetError || !ownedAsset) throw new Error("Asset not found")

  const notes = String(formData.get("notes") || "").trim()
  const performedBy = String(formData.get("performed_by") || "").trim()
  const cost = formData.get("cost")
  const servicedAt = String(formData.get("serviced_at") || "")

  const receiptPath = String(formData.get("receipt_path") || "").trim()
  const receiptName = String(formData.get("receipt_name") || "").trim()
  const receiptMime = String(formData.get("receipt_mime") || "").trim()

  let receiptDocumentId: string | null = null
  if (receiptPath) {
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        asset_id: assetId,
        owner_id: user.id,
        kind: "service_bill",
        storage_path: receiptPath,
        file_name: receiptName || null,
        mime_type: receiptMime || null,
      })
      .select("id")
      .single()
    if (docError) throw new Error(docError.message)
    receiptDocumentId = doc?.id ?? null
  }

  const { error } = await supabase.from("service_records").insert({
    asset_id: assetId,
    owner_id: user.id,
    title,
    notes: notes || null,
    performed_by: performedBy || null,
    cost: cost ? Number(cost) : null,
    receipt_document_id: receiptDocumentId,
    serviced_at: servicedAt || new Date().toISOString().slice(0, 10),
  })

  if (error) throw new Error(error.message)

  revalidatePath("/service")
  revalidatePath(`/passport/${assetId}`)
}

export async function deleteServiceRecord(id: string, assetId: string) {
  const { supabase, user } = await requireUser()
  await supabase.from("service_records").delete().eq("id", id).eq("owner_id", user.id)
  revalidatePath("/service")
  revalidatePath(`/passport/${assetId}`)
}
