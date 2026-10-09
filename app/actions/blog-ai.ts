"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { generateBlogDraft, type BlogDraft } from "@/lib/anthropic"

const DAILY_BLOG_DRAFT_LIMIT = 10

// Drafts only: returns text for the editor. A human reviews, edits and publishes.
export async function draftPostWithAI(topic: string): Promise<BlogDraft> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: p } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (p?.platform_role !== "admin") throw new Error("Admin access required")

  const t = topic.trim().slice(0, 200)
  if (t.length < 5) throw new Error("Describe the topic in a few words.")

  const { data: allowed, error } = await supabase.rpc("check_and_increment_ai_usage", {
    p_kind: "blog_draft",
    p_limit: DAILY_BLOG_DRAFT_LIMIT,
  })
  if (error) throw new Error(error.message)
  if (!allowed) throw new Error("Daily AI draft limit reached.")

  return generateBlogDraft(t)
}
