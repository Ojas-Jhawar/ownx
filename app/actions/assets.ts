"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { extractInvoiceData } from "@/lib/anthropic"
import type { InvoiceExtraction } from "@/lib/types"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

// Step 1 (upload page): create an empty draft the moment the user picks a
// file, so we have an id to upload the invoice under and to attach
// extraction results to.
export async function createDraftAsset(): Promise<{ assetId: string }> {
  const { supabase, user } = await requireUser()

  const { data, error } = await supabase
    .from("assets")
    .insert({ owner_id: user.id, status: "draft" })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message || "Could not start a new passport")
  return { assetId: data.id }
}

// FIX: nothing previously rate-limited or size-capped calls into the
// Anthropic API. Since any logged-in user could call runExtraction /
// runAiDiagnosis (see diagnose.ts) as many times as they liked with
// arbitrarily large files, this was an open door to a large, unexpected API
// bill — whether from a bug in a client retry loop or deliberate abuse.
// MAX_INVOICE_BYTES caps a single extraction's input; the per-user,
// per-day cap below is enforced by the `check_and_increment_ai_usage` RPC
// added in migration 011 (SECURITY DEFINER, so the count can't be read or
// reset from the client).
const MAX_INVOICE_BYTES = 15 * 1024 * 1024 // 15 MB
const DAILY_EXTRACTION_LIMIT = 20

// Step 2 (processing page): the invoice was already uploaded to Storage
// client-side (see create/upload/page.tsx). This downloads it server-side
// (so the Anthropic API key never touches the browser), runs the real
// extraction, and saves the result onto the draft asset.
export async function runExtraction(params: {
  assetId: string
  storagePath: string
  mimeType: string
  fileName: string
}): Promise<InvoiceExtraction> {
  const { supabase, user } = await requireUser()

  const { data: allowed, error: rateLimitError } = await supabase.rpc("check_and_increment_ai_usage", {
    p_kind: "invoice_extraction",
    p_limit: DAILY_EXTRACTION_LIMIT,
  })
  if (rateLimitError) throw new Error(rateLimitError.message)
  if (!allowed) {
    throw new Error(
      "You've hit today's limit for AI invoice extraction. Please try again tomorrow, or enter the details manually.",
    )
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("documents")
    .download(params.storagePath)
  if (downloadError || !fileBlob) throw new Error(downloadError?.message || "Could not read uploaded file")

  if (fileBlob.size > MAX_INVOICE_BYTES) {
    throw new Error("That file is larger than 15 MB — please upload a smaller invoice, or enter details manually.")
  }

  await supabase.from("documents").insert({
    asset_id: params.assetId,
    owner_id: user.id,
    kind: "invoice",
    storage_path: params.storagePath,
    file_name: params.fileName,
    mime_type: params.mimeType,
  })

  const supportedMime = ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(params.mimeType)
    ? (params.mimeType as "image/jpeg" | "image/png" | "image/webp" | "application/pdf")
    : "image/jpeg"

  const arrayBuffer = await fileBlob.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  const extraction = await extractInvoiceData({ base64, mediaType: supportedMime })

  await supabase
    .from("assets")
    .update({
      product_name: extraction.product_name.value,
      brand: extraction.brand.value,
      category: extraction.category.value,
      serial_number: extraction.serial_number.value,
      purchase_date: extraction.purchase_date.value,
      purchase_price: extraction.purchase_price.value,
      currency: extraction.currency.value || "INR",
      warranty_months: extraction.warranty_months.value,
      condition_notes: extraction.notes.value,
      extraction_source: "ai",
      extraction_raw: extraction as any,
      extraction_confidence: {
        product_name: extraction.product_name.confidence,
        brand: extraction.brand.confidence,
        category: extraction.category.confidence,
        serial_number: extraction.serial_number.confidence,
        purchase_date: extraction.purchase_date.confidence,
        purchase_price: extraction.purchase_price.confidence,
        warranty_months: extraction.warranty_months.confidence,
      },
    })
    .eq("id", params.assetId)
    .eq("owner_id", user.id)

  return extraction
}

// Step 3 (review page): user confirms/edits fields, asset goes live.
export async function confirmAsset(assetId: string, formData: FormData) {
  const { supabase, user } = await requireUser()

  const purchasePrice = formData.get("purchase_price")
  const warrantyMonths = formData.get("warranty_months")
  const conditionScore = formData.get("condition_score")

  const { error } = await supabase
    .from("assets")
    .update({
      status: "active",
      product_name: String(formData.get("product_name") || "").trim() || null,
      brand: String(formData.get("brand") || "").trim() || null,
      category: String(formData.get("category") || "").trim() || null,
      serial_number: String(formData.get("serial_number") || "").trim() || null,
      purchase_date: String(formData.get("purchase_date") || "") || null,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      currency: String(formData.get("currency") || "INR"),
      warranty_months: warrantyMonths ? Number(warrantyMonths) : null,
      condition_score: conditionScore ? Number(conditionScore) : null,
      // Cover photo uploaded on the review step (see PhotoPicker in
      // app/create/review/page.tsx). Empty string from the hidden input
      // means "no photo chosen" — normalize that to null rather than
      // storing "".
      image_url: String(formData.get("image_url") || "").trim() || null,
      extraction_source: formData.get("extraction_source") === "ai" ? "ai" : "manual",
    })
    .eq("id", assetId)
    .eq("owner_id", user.id)

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard")
  redirect(`/passport/${assetId}`)
}

// Used by the passport page's inline "Edit" action.
export async function updateAsset(assetId: string, formData: FormData) {
  const { supabase, user } = await requireUser()

  const purchasePrice = formData.get("purchase_price")
  const warrantyMonths = formData.get("warranty_months")
  const conditionScore = formData.get("condition_score")

  const { error } = await supabase
    .from("assets")
    .update({
      product_name: String(formData.get("product_name") || "").trim() || null,
      brand: String(formData.get("brand") || "").trim() || null,
      serial_number: String(formData.get("serial_number") || "").trim() || null,
      purchase_date: String(formData.get("purchase_date") || "") || null,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      warranty_months: warrantyMonths ? Number(warrantyMonths) : null,
      condition_score: conditionScore ? Number(conditionScore) : null,
      // Allow the photo to be replaced from the passport page's edit form
      // too, not just at creation. If passport-tabs.tsx's edit form doesn't
      // include an image_url field, formData.get() returns null and this
      // is a no-op there until that form is updated to include a
      // PhotoPicker as well.
      ...(formData.has("image_url")
        ? { image_url: String(formData.get("image_url") || "").trim() || null }
        : {}),
    })
    .eq("id", assetId)
    .eq("owner_id", user.id)

  if (error) throw new Error(error.message)

  revalidatePath(`/passport/${assetId}`)
  revalidatePath("/dashboard")
}

export async function deleteAsset(assetId: string) {
  const { supabase, user } = await requireUser()
  await supabase.from("assets").delete().eq("id", assetId).eq("owner_id", user.id)
  revalidatePath("/dashboard")
  redirect("/dashboard")
}
