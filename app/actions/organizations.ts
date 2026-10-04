"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// SECURITY: organisations are no longer self-serve. The old createOrganization
// and approveOrganization actions are gone. Businesses apply through the
// Google Form; an Ownx admin verifies them offline and then uses the actions
// below. Every check here is backed by RLS / SECURITY DEFINER functions in
// migration 010, so calling Supabase directly can't bypass it either.

export type AdminOrgState = { error: string | null; success?: string }

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") throw new Error("Admin access required")

  return { supabase, user }
}

const CreateOrgSchema = z.object({
  org_name: z.string().trim().min(2, "Organisation name is too short").max(120),
  org_type: z.enum(["manufacturer", "seller", "repair_shop"], {
    errorMap: () => ({ message: "Choose an organisation type" }),
  }),
  owner_name: z.string().trim().min(2, "Owner name is required").max(100),
  owner_email: z.string().trim().toLowerCase().email("Enter a valid owner email"),
  registration_number: z.string().trim().min(5, "Enter the GSTIN / registration number").max(40),
  contact_phone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
})

// Staff creates an organisation for an already-verified business.
// The owner is invited by email and sets their OWN password — staff never
// see or send passwords.
export async function createOrganizationForOwner(_prev: AdminOrgState, fd: FormData): Promise<AdminOrgState> {
  const { supabase } = await requireAdmin()

  const parsed = CreateOrgSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const v = parsed.data

  const admin = createAdminClient()

  // 1. Find the owner's account, or invite them.
  const { data: existing } = await admin.from("profiles").select("id").eq("email", v.owner_email).maybeSingle()

  let ownerId = existing?.id as string | undefined
  let invited = false

  if (!ownerId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(v.owner_email, {
      data: { full_name: v.owner_name },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    })
    if (error || !data.user) return { error: error?.message || "Could not invite the owner." }
    ownerId = data.user.id
    invited = true
  }

  // 2. Create org + owner membership + role atomically (runs as the admin's
  //    own session so the SQL function's is_admin() check applies).
  const { error: rpcError } = await supabase.rpc("admin_create_organization", {
    p_name: v.org_name,
    p_type: v.org_type,
    p_owner_user_id: ownerId,
    p_registration_number: v.registration_number,
    p_contact_email: v.owner_email,
    p_contact_phone: v.contact_phone || null,
    p_notes: v.notes || null,
  })

  if (rpcError) {
    if (rpcError.message.includes("organizations_reg_no_uidx")) {
      return { error: "An organisation with this registration number already exists." }
    }
    return { error: rpcError.message }
  }

  revalidatePath("/admin/organizations")
  return {
    error: null,
    success: invited
      ? `Created "${v.org_name}". An invite email was sent to ${v.owner_email} so they can set a password.`
      : `Created "${v.org_name}" and linked it to the existing account ${v.owner_email}.`,
  }
}

// Suspend / reinstate. Suspended orgs (verified = false) can't register
// devices, record sales or sign repairs, enforced by RLS from migration 008.
export async function setOrganizationVerified(orgId: string, verified: boolean) {
  const { supabase, user } = await requireAdmin()

  const { error } = await supabase.from("organizations").update({ verified }).eq("id", orgId)
  if (error) throw new Error(error.message)

  // The audit table has no client insert policy, so write it with the service role.
  await createAdminClient()
    .from("admin_audit_log")
    .insert({
      actor_id: user.id,
      action: verified ? "reinstate_organization" : "suspend_organization",
      target_type: "organization",
      target_id: orgId,
    })

  revalidatePath("/admin/organizations")
  revalidatePath("/organization")
}
