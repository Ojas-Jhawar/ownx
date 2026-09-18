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

// Self-serve org creation for this demo. In production this would create the
// org in a "pending" state and require Ownx admin verification before the
// `verified` flag flips and the org can register/sign anything.
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
    .insert({ name, org_type: orgType })
    .select("id")
    .single()
  if (error || !org) throw new Error(error?.message || "Could not create organization")

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" })
  if (memberError) throw new Error(memberError.message)

  await supabase.from("profiles").update({ platform_role: orgType }).eq("id", user.id)

  revalidatePath("/organization")
  redirect(orgType === "manufacturer" ? "/manufacturer" : orgType === "seller" ? "/seller" : "/repair")
}