"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ApplySchema = z.object({
  org_name: z.string().trim().min(2).max(120),
  org_type: z.enum(["manufacturer", "seller", "repair_shop"]),
  contact_name: z.string().trim().min(2).max(100),
  contact_email: z.string().trim().toLowerCase().email(),
  contact_phone: z.string().trim().max(20).optional(),
  website: z.string().trim().url().optional().or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  registration_number: z.string().trim().min(5).max(40),   // GSTIN / CIN
  message: z.string().trim().max(1000).optional(),
})

const MAX_FILE = 5 * 1024 * 1024
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"]

export async function submitOrgApplication(_prev: { error: string | null; ok?: boolean }, fd: FormData) {
  if (fd.get("website_url")) return { error: null, ok: true }       // honeypot: bots fill this hidden field

  const parsed = ApplySchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const v = parsed.data
  const admin = createAdminClient()

  // Simple abuse limit: max 3 applications per email per 24h
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await admin.from("organization_applications")
    .select("id", { count: "exact", head: true })
    .eq("contact_email", v.contact_email).gte("created_at", since)
  if ((count ?? 0) >= 3) return { error: "Too many applications from this email. Try again tomorrow." }

  const files = fd.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4)
  const paths: string[] = []
  for (const f of files) {
    if (!ALLOWED.includes(f.type) || f.size > MAX_FILE) return { error: "Documents must be PDF/JPG/PNG under 5 MB." }
    const path = `${crypto.randomUUID()}/${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const { error } = await admin.storage.from("org-applications").upload(path, f, { contentType: f.type })
    if (error) return { error: "Could not upload documents. Please try again." }
    paths.push(path)
  }

  const { error } = await admin.from("organization_applications").insert({
    ...v, website: v.website || null, document_paths: paths,
  })
  if (error) return { error: "Could not submit your application." }
  return { error: null, ok: true }
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: p } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (p?.platform_role !== "admin") throw new Error("Admin access required")
  return { supabase, user }
}

export async function approveApplication(appId: string, fd: FormData) {
  const { supabase } = await requireAdmin()
  const { data: app } = await supabase.from("organization_applications").select("*").eq("id", appId).single()
  if (!app) throw new Error("Application not found")

  const admin = createAdminClient()
  const { data: existing } = await admin.from("profiles").select("id").eq("email", app.contact_email).maybeSingle()

  let ownerId = existing?.id as string | undefined
  if (!ownerId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(app.contact_email, {
      data: { full_name: app.contact_name },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,   // owner sets own password here
    })
    if (error || !data.user) throw new Error(error?.message || "Could not invite owner")
    ownerId = data.user.id
  }

  const { error } = await supabase.rpc("approve_org_application", {
    p_app_id: appId, p_owner_user_id: ownerId, p_notes: String(fd.get("notes") || "") || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/admin/organizations")
}

export async function rejectApplication(appId: string, fd: FormData) {
  const { supabase, user } = await requireAdmin()
  const status = fd.get("action") === "needs_info" ? "needs_info" : "rejected"
  const { error } = await supabase.from("organization_applications").update({
    status, review_notes: String(fd.get("notes") || "") || null, reviewed_by: user.id, reviewed_at: new Date().toISOString(),
  }).eq("id", appId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/organizations")
}
