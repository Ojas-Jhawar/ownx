"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { generateOwnxId } from "@/lib/ownx-id"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

async function findUserOrg(supabase: any, userId: string, orgType: string) {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, organizations ( id, name, org_type )")
    .eq("user_id", userId)
  const match = (data || []).find((m: any) => m.organizations?.org_type === orgType)
  return match ? { id: match.organization_id, name: match.organizations.name } : null
}

// Step 1: Manufacturer registers a device and gets a permanent Ownx ID.
export async function createDevice(formData: FormData) {
  const { supabase, user } = await requireUser()
  const org = await findUserOrg(supabase, user.id, "manufacturer")
  if (!org) throw new Error("You need a manufacturer organization to register devices.")

  let ownxId = generateOwnxId()
  let device: { id: string; ownx_id: string } | null = null

  for (let attempt = 0; attempt < 5 && !device; attempt++) {
    const { data, error } = await supabase
      .from("devices")
      .insert({
        ownx_id: ownxId,
        manufacturer_org_id: org.id,
        product_name: String(formData.get("product_name") || "").trim(),
        brand: String(formData.get("brand") || "").trim() || null,
        category: String(formData.get("category") || "").trim() || null,
        model_number: String(formData.get("model_number") || "").trim() || null,
        serial_number: String(formData.get("serial_number") || "").trim() || null,
        imei: String(formData.get("imei") || "").trim() || null,
        manufactured_at: String(formData.get("manufactured_at") || "") || null,
        warranty_months: formData.get("warranty_months") ? Number(formData.get("warranty_months")) : null,
        authenticity_notes: String(formData.get("authenticity_notes") || "").trim() || null,
      })
      .select("id, ownx_id")
      .single()

    if (!error) {
      device = data
    } else if (!(error.message || "").toLowerCase().includes("duplicate")) {
      throw new Error(error.message)
    } else {
      ownxId = generateOwnxId() // collision (rare) — retry with a new id
    }
  }
  if (!device) throw new Error("Could not generate a unique Ownx ID — please try again.")

  await supabase.from("lifecycle_events").insert({
    device_id: device.id,
    event_type: "manufactured",
    status: "confirmed",
    actor_user_id: user.id,
    actor_org_id: org.id,
    title: "Device manufactured & registered",
    detail: `Registered by ${org.name}.`,
  })

  revalidatePath("/manufacturer")
  redirect(`/manufacturer?created=${device.ownx_id}`)
}

// Used by the seller and repair-shop dashboards to find a device by its Ownx ID.
export async function lookupDeviceByOwnxId(ownxId: string) {
  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from("devices")
    .select("*, organizations:manufacturer_org_id ( name )")
    .eq("ownx_id", ownxId.trim().toUpperCase())
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// Step 2: Seller records a sale, inviting the buyer by email.
export async function recordSale(deviceId: string, formData: FormData) {
  const { supabase, user } = await requireUser()
  const org = await findUserOrg(supabase, user.id, "seller")
  if (!org) throw new Error("You need a seller organization to record a sale.")

  const toEmail = String(formData.get("to_email") || "").trim().toLowerCase()
  if (!toEmail.includes("@")) throw new Error("Enter a valid buyer email.")
  const salePrice = formData.get("sale_price") ? Number(formData.get("sale_price")) : null
  const note = String(formData.get("note") || "").trim() || null

  const { data: pending } = await supabase
    .from("device_transfers")
    .select("id")
    .eq("device_id", deviceId)
    .eq("status", "pending")
    .maybeSingle()
  if (pending) throw new Error("This device already has a pending sale.")

  const { error } = await supabase.from("device_transfers").insert({
    device_id: deviceId,
    from_org_id: org.id,
    to_email: toEmail,
    sale_price: salePrice,
    note,
    status: "pending",
  })
  if (error) throw new Error(error.message)

  await supabase.from("lifecycle_events").insert({
    device_id: deviceId,
    event_type: "sale_recorded",
    status: "confirmed",
    actor_user_id: user.id,
    actor_org_id: org.id,
    title: "Sale recorded",
    detail: `Sold to ${toEmail}${salePrice ? ` for ₹${salePrice}` : ""}. Awaiting buyer acceptance.`,
  })

  await supabase.from("devices").update({ status: "sold" }).eq("id", deviceId)
  revalidatePath("/seller")
}

// Step 3: Buyer accepts (called from /transfers).
export async function acceptDeviceTransfer(transferId: string) {
  const { supabase } = await requireUser()
  const { error } = await supabase.rpc("accept_device_transfer", { p_transfer_id: transferId })
  if (error) throw new Error(error.message)
  revalidatePath("/transfers")
  revalidatePath("/dashboard")
}

export async function declineDeviceTransfer(transferId: string) {
  const { supabase } = await requireUser()
  await supabase.from("device_transfers").update({ status: "declined", resolved_at: new Date().toISOString() }).eq("id", transferId)
  revalidatePath("/transfers")
}

// Step 4: Repair shop signs a verified repair event (and mirrors it into the
// owner's existing Service tab when the device has already been claimed).
export async function addRepairEvent(deviceId: string, formData: FormData) {
  const { supabase, user } = await requireUser()
  const org = await findUserOrg(supabase, user.id, "repair_shop")
  if (!org) throw new Error("You need a repair shop organization to log repairs.")

  const title = String(formData.get("title") || "").trim()
  const detail = String(formData.get("detail") || "").trim()
  const cost = formData.get("cost") ? Number(formData.get("cost")) : null
  if (!title) throw new Error("Describe the work performed.")

  const { data: device } = await supabase.from("devices").select("*").eq("id", deviceId).single()
  if (!device) throw new Error("Device not found")

  const { error } = await supabase.from("lifecycle_events").insert({
    device_id: deviceId,
    event_type: "repair",
    status: "verified",
    actor_user_id: user.id,
    actor_org_id: org.id,
    title,
    detail: detail || null,
    metadata: cost !== null ? { cost } : {},
  })
  if (error) throw new Error(error.message)

  if (device.asset_id && device.current_owner_id) {
    await supabase.from("service_records").insert({
      asset_id: device.asset_id,
      owner_id: device.current_owner_id,
      title,
      notes: detail || null,
      performed_by: org.name,
      cost,
      serviced_at: new Date().toISOString().slice(0, 10),
    })
    revalidatePath(`/passport/${device.asset_id}`)
  }

  revalidatePath("/repair")
}

// Owner-side: a low-trust "reported" note (e.g. "added a case", "screen protector
// applied"). Never auto-elevated past 'reported' — only orgs can post
// verified/confirmed events, per the trust model.
export async function addOwnerNote(deviceId: string, formData: FormData) {
  const { supabase, user } = await requireUser()
  const title = String(formData.get("title") || "").trim()
  const detail = String(formData.get("detail") || "").trim()
  if (!title) throw new Error("Add a short title.")

  const { error } = await supabase.from("lifecycle_events").insert({
    device_id: deviceId,
    event_type: "note",
    status: "reported",
    actor_user_id: user.id,
    title,
    detail: detail || null,
  })
  if (error) throw new Error(error.message)

  const { data: device } = await supabase.from("devices").select("asset_id").eq("id", deviceId).maybeSingle()
  if (device?.asset_id) revalidatePath(`/passport/${device.asset_id}`)
}