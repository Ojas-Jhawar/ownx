"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { randomSlug } from "@/lib/utils"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") throw new Error("Admin access required")
  return { supabase, user }
}

const CATEGORIES = ["guide", "maintenance", "sustainability", "news"]

function parseTags(raw: FormDataEntryValue | null): string[] {
  return Array.from(
    new Set(
      String(raw || "")
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-\s]/g, "").replace(/\s+/g, "-"))
        .filter(Boolean),
    ),
  ).slice(0, 8)
}

function category(raw: FormDataEntryValue | null) {
  const c = String(raw || "guide")
  return CATEGORIES.includes(c) ? c : "guide"
}

function refresh() {
  revalidatePath("/blog")
  revalidatePath("/blog/rss.xml")
  revalidatePath("/sitemap.xml")
  revalidatePath("/admin/blog")
}

export async function createBlogPost(formData: FormData) {
  const { supabase, user } = await requireAdmin()
  const title = String(formData.get("title") || "").trim()
  if (!title) throw new Error("Title is required")
  const status = formData.get("status") === "published" ? "published" : "draft"

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      author_id: user.id,
      slug: randomSlug(title),
      title,
      excerpt: String(formData.get("excerpt") || "").trim() || null,
      cover_image_url: String(formData.get("cover_image_url") || "").trim() || null,
      content: String(formData.get("content") || "").trim(),
      category: category(formData.get("category")),
      tags: parseTags(formData.get("tags")),
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message || "Could not create post")

  refresh()
  redirect(`/admin/blog/${data.id}`)
}

export async function updateBlogPost(postId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const status = formData.get("status") === "published" ? "published" : "draft"
  const { data: existing } = await supabase.from("blog_posts").select("status").eq("id", postId).single()

  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: String(formData.get("title") || "").trim(),
      excerpt: String(formData.get("excerpt") || "").trim() || null,
      cover_image_url: String(formData.get("cover_image_url") || "").trim() || null,
      content: String(formData.get("content") || "").trim(),
      category: category(formData.get("category")),
      tags: parseTags(formData.get("tags")),
      status,
      published_at: status === "published" && existing?.status !== "published" ? new Date().toISOString() : undefined,
    })
    .eq("id", postId)
  if (error) throw new Error(error.message)
  refresh()
}

export async function deleteBlogPost(postId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from("blog_posts").delete().eq("id", postId)
  refresh()
}
