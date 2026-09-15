"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type AuthState = { error: string | null }

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("fullName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")

  if (!fullName || !email || !password) return { error: "All fields are required." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) return { error: error.message }

  // When Supabase email confirmation is enabled, signUp succeeds but does not
  // create a session yet. Do not send the user into a protected route.
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent("Account created. Check your email to confirm your account, then log in.")}`)
  }

  redirect("/onboarding")
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  const next = String(formData.get("next") || "/dashboard")

  if (!email || !password) return { error: "Email and password are required." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Supabase has useful auth errors (for example, unconfirmed email).
    // Surface a safe, actionable message instead of masking every failure as
    // a bad password.
    const message = error.message.toLowerCase()
    if (message.includes("email not confirmed")) {
      return { error: "Your email is not confirmed yet. Check your inbox for the confirmation link." }
    }
    if (message.includes("invalid login credentials")) {
      return { error: "The email or password is incorrect." }
    }
    return { error: error.message }
  }

  if (!data.session) {
    return { error: "Login succeeded, but no session was created. Please try again." }
  }

  redirect(next.startsWith("/") ? next : "/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
