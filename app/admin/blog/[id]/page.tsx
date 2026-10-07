import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { BlogEditor } from "@/components/admin/blog-editor"
import { createClient } from "@/lib/supabase/server"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") redirect("/dashboard")

  const { data: post } = await supabase.from("blog_posts").select("id, slug, title, excerpt, cover_image_url, content, category, status").eq("id", id).maybeSingle()
  if (!post) notFound()

  return (
    <AppShell active="Admin" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/blog" className="text-sm text-muted-foreground hover:text-ink">Back to posts</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Edit post</h1>
        {post.status === "published" && <Link href={`/blog/${post.slug}`} className="text-sm font-medium text-brand hover:underline">View live post</Link>}
        <div className="mt-6"><BlogEditor post={post} /></div>
      </div>
    </AppShell>
  )
}
