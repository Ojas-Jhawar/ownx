"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type ProfileState = { error: string | null; success?: boolean }

// NOTE: the previous return type — `{ error: string | null; success?: boolean }`
// as an *inferred* return type rather than an explicit one — didn't line up
// with the discriminated union `useActionState` in settings-form.tsx expects
// ( `{ error: string; success?: undefined } | { error: null; success: boolean }` ).
// Concretely: `return { error: null }` (the initial/error-free early-return
// path) is missing `success`, which the second branch of that union requires.
// Declaring the return type explicitly as `ProfileState` — a plain optional
// field rather than two mutually exclusive branches — makes every return
// statement in this function actually satisfy it, and was previously only
// "working" because `next.config.mjs` had `ignoreBuildErrors: true`.
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
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
