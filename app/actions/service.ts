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
  const notes = String(formData.get("notes") || "").trim()
  const performedBy = String(formData.get("performed_by") || "").trim()
  const cost = formData.get("cost")
  const servicedAt = String(formData.get("serviced_at") || "")

  const receiptPath = String(formData.get("receipt_path") || "").trim()
  const receiptName = String(formData.get("receipt_name") || "").trim()
  const receiptMime = String(formData.get("receipt_mime") || "").trim()

  if (!assetId || !title) throw new Error("Asset and title are required")

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
