"use client"

import { useState, useTransition } from "react"
import { createBlogPost, updateBlogPost, deleteBlogPost } from "@/app/actions/blog"
import { Markdown } from "@/components/markdown"

type Post = { id: string; title: string; excerpt: string | null; cover_image_url: string | null; content: string; category: string; status: string }
const input = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"

export function BlogEditor({ post }: { post?: Post }) {
  const [content, setContent] = useState(post?.content ?? "")
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  return (
    <form
      className="space-y-4"
      action={(fd) => start(async () => {
        setError(null); setSaved(false)
        try {
          if (post) { await updateBlogPost(post.id, fd); setSaved(true) } else await createBlogPost(fd)
        } catch (e) { setError(e instanceof Error ? e.message : "Could not save") }
      })}
    >
      <div>
        <label htmlFor="title" className="text-xs font-medium text-muted-foreground">Title</label>
        <input id="title" name="title" required defaultValue={post?.title} className={input} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="text-xs font-medium text-muted-foreground">Category</label>
          <select id="category" name="category" defaultValue={post?.category ?? "guide"} className={input}>
            {["guide", "maintenance", "sustainability", "news"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cover_image_url" className="text-xs font-medium text-muted-foreground">Cover image URL</label>
          <input id="cover_image_url" name="cover_image_url" type="url" defaultValue={post?.cover_image_url ?? ""} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="excerpt" className="text-xs font-medium text-muted-foreground">Excerpt (used for search results and sharing)</label>
        <textarea id="excerpt" name="excerpt" rows={2} maxLength={200} defaultValue={post?.excerpt ?? ""} className={input} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="content" className="text-xs font-medium text-muted-foreground">Content (Markdown)</label>
          <div className="flex gap-1 rounded-full border border-border p-0.5 text-xs">
            {(["write", "preview"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={t === tab ? "rounded-full bg-brand-soft px-3 py-1 font-medium capitalize text-brand" : "rounded-full px-3 py-1 capitalize text-muted-foreground"}>{t}</button>
            ))}
          </div>
        </div>
        {/* Keep the textarea mounted so its value is always submitted. */}
        <textarea id="content" name="content" required rows={18} value={content} onChange={(e) => setContent(e.target.value)}
          className={`${input} font-mono ${tab === "preview" ? "hidden" : ""}`} />
        {tab === "preview" && (
          <div className="mt-1 min-h-64 rounded-lg border border-border bg-card p-5">
            {content.trim() ? <Markdown>{content}</Markdown> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-brand">Saved.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="status" value="published" disabled={pending} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60">
          {pending ? "Saving…" : post?.status === "published" ? "Save changes" : "Publish"}
        </button>
        <button type="submit" name="status" value="draft" disabled={pending} className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60">
          {post?.status === "published" ? "Unpublish to draft" : "Save draft"}
        </button>
        {post && (
          <button type="button" disabled={pending}
            onClick={() => { if (confirm("Delete this post permanently?")) start(async () => { await deleteBlogPost(post.id); window.location.href = "/admin/blog" }) }}
            className="ml-auto rounded-full px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5">Delete</button>
        )}
      </div>
    </form>
  )
}
