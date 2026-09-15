"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function updateProfile(_prev: { error: string | null; success?: boolean }, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const fullName = String(formData.get("full_name") || "").trim()
  if (!fullName) return { error: "Name can't be empty." }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, avatar_initials: fullName.slice(0, 2).toUpperCase() })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { error: null, success: true }
}
