import "server-only"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function requireAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/admin")
  const { data: p } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (p?.platform_role !== "admin") notFound() // don't reveal that /admin exists
  return { supabase, user }
}
