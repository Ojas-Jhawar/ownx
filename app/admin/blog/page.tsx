import Link from "next/link"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app/app-shell"
import { BlogEditor } from "@/components/admin/blog-editor"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") redirect("/dashboard")

  const { data: posts } = await supabase.from("blog_posts").select("id, slug, title, status, published_at, updated_at").order("updated_at", { ascending: false })

  return (
    <AppShell active="Admin" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Blog</h1>
        <div className="mt-4 space-y-2">
          {(posts || []).map((p) => (
            <Link key={p.id} href={`/admin/blog/${p.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-brand/40">
              <span className="min-w-0 truncate text-sm font-medium text-ink">{p.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {p.status === "published" ? `Published ${formatDate(p.published_at)}` : "Draft"}
              </span>
            </Link>
          ))}
          {(!posts || posts.length === 0) && <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No posts yet. Write the first one below.</p>}
        </div>
        <details className="mt-6 rounded-2xl border border-border bg-card p-5" open={!posts || posts.length === 0}>
          <summary className="cursor-pointer font-semibold text-ink">New post</summary>
          <div className="mt-4"><BlogEditor /></div>
        </details>
      </div>
    </AppShell>
  )
}
