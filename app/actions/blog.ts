"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { randomSlug } from "@/lib/utils"

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") throw new Error("Admin access required")

  return { supabase, user }
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
      category: String(formData.get("category") || "guide"),
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("slug")
    .single()

  if (error || !data) throw new Error(error?.message || "Could not create post")

  revalidatePath("/blog")
  redirect(`/blog/${data.slug}`)
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
      category: String(formData.get("category") || "guide"),
      status,
      published_at: status === "published" && existing?.status !== "published" ? new Date().toISOString() : undefined,
    })
    .eq("id", postId)

  if (error) throw new Error(error.message)
  revalidatePath("/blog")
}

export async function deleteBlogPost(postId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from("blog_posts").delete().eq("id", postId)
  revalidatePath("/blog")
}
