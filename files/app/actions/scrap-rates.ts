"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: p } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (p?.platform_role !== "admin") throw new Error("Admin access required")
  return supabase
}

export async function updateScrapRate(id: string, fd: FormData) {
  const supabase = await requireAdmin()
  const patch: Record<string, number> = {}
  for (const key of ["pct_of_weight", "rate_per_kg", "grams", "rate_per_gram"]) {
    const raw = fd.get(key)
    if (raw === null || raw === "") continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid value for ${key}`)
    patch[key] = n
  }
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from("scrap_rates").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/tools/scrap-value")
  revalidatePath("/admin/scrap-rates")
}
