"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { OrgType } from "@/lib/types"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

// SECURITY: organizations are no longer auto-verified (see
// supabase/migrations/008_security_hardening.sql, which flips the
// `organizations.verified` column default to false). A brand-new org can
// still be created here so the person can start filling out their profile,
// but every action that mints a trust signal shown to the public — minting
// an Ownx ID, recording a sale, or signing a repair — is blocked at the RLS
// layer until an admin sets `verified = true`. Until then the org's own
// dashboard pages show a "Pending verification" banner (see
// app/organization/page.tsx).
export async function createOrganization(formData: FormData) {
  const { supabase, user } = await requireUser()

  const name = String(formData.get("name") || "").trim()
  const orgType = String(formData.get("org_type") || "") as OrgType
  if (!name) throw new Error("Organization name is required")
  if (!["manufacturer", "seller", "repair_shop"].includes(orgType)) {
    throw new Error("Choose a valid organization type")
  }

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name, org_type: orgType }) // verified defaults to false (migration 008)
    .select("id")
    .single()
  if (error || !org) throw new Error(error?.message || "Could not create organization")

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" })
  if (memberError) throw new Error(memberError.message)

  await supabase.from("profiles").update({ platform_role: orgType }).eq("id", user.id)

  revalidatePath("/organization")
  // Route to the shared /organization page rather than straight into the
  // business dashboard — the dashboard now needs to show the pending-
  // verification state, and /organization is where that copy lives.
  redirect("/organization?created=1")
}

// Admin-only: approves a pending organization. Also gated by the RLS policy
// "Admins can approve organizations" in migration 008 — this check here is
// just so the person gets a clear error instead of a silent RLS no-op.
export async function approveOrganization(organizationId: string) {
  const { supabase, user } = await requireUser()

  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") throw new Error("Admin access required")

  const { error } = await supabase.from("organizations").update({ verified: true }).eq("id", organizationId)
  if (error) throw new Error(error.message)

  revalidatePath("/organization")
  revalidatePath("/admin/organizations")
}
