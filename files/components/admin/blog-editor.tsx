"use client"

import { useRef, useState, useTransition } from "react"
import { Sparkles, ImagePlus } from "lucide-react"
import { createBlogPost, updateBlogPost, deleteBlogPost } from "@/app/actions/blog"
import { draftPostWithAI } from "@/app/actions/blog-ai"
import { Markdown } from "@/components/markdown"
import { createClient } from "@/lib/supabase/client"

type Post = {
  id: string; title: string; excerpt: string | null; cover_image_url: string | null
  content: string; category: string; status: string; tags?: string[] | null
}
const input = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
const MAX_COVER = 5 * 1024 * 1024

export function BlogEditor({ post }: { post?: Post }) {
  const [title, setTitle] = useState(post?.title ?? "")
  const [category, setCategory] = useState(post?.category ?? "guide")
  const [cover, setCover] = useState(post?.cover_image_url ?? "")
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [tags, setTags] = useState((post?.tags ?? []).join(", "))
  const [content, setContent] = useState(post?.content ?? "")
  const [topic, setTopic] = useState("")
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pending, start] = useTransition()
  const [drafting, startDraft] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadCover(file: File) {
    setError(null)
    if (file.size > MAX_COVER) return setError("Cover image must be under 5 MB.")
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Session expired. Log in again.")
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
      const { error: upErr } = await supabase.storage.from("blog-covers").upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      setCover(supabase.storage.from("blog-covers").getPublicUrl(path).data.publicUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function aiDraft() {
    setError(null)
    startDraft(async () => {
      try {
        const d = await draftPostWithAI(topic)
        setTitle(d.title); setExcerpt(d.excerpt); setContent(d.content)
        setCategory(d.category); setTags(d.tags.join(", "))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not draft")
      }
    })
  }

  return (
    <form
      className="space-y-4"
      action={(fd) => start(async () => {
        setError(null); setSaved(false)
        try {
          if (post) { await updateBlogPost(post.id, fd); setSaved(true) } else await createBlogPost(fd)
        } catch (e) {
          // redirect() from the server action throws a control-flow error; let it through.
          if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e
          setError(e instanceof Error ? e.message : "Could not save")
        }
      })}
    >
      <div className="rounded-xl border border-dashed border-border bg-background p-4">
        <label htmlFor="topic" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-brand" /> Draft with AI (fills the fields below; you review and publish)
        </label>
        <div className="mt-2 flex gap-2">
          <input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How to spot a refurbished phone sold as new" className={`${input} mt-0`} />
          <button type="button" onClick={aiDraft} disabled={drafting || topic.trim().length < 5}
            className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {drafting ? "Drafting…" : "Draft"}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="title" className="text-xs font-medium text-muted-foreground">Title</label>
        <input id="title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="text-xs font-medium text-muted-foreground">Category</label>
          <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {["guide", "maintenance", "sustainability", "news"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tags" className="text-xs font-medium text-muted-foreground">Tags (comma separated)</label>
          <input id="tags" name="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="battery, laptop" className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="cover_image_url" className="text-xs font-medium text-muted-foreground">Cover image</label>
        <div className="mt-1 flex gap-2">
          <input id="cover_image_url" name="cover_image_url" type="url" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Paste a URL or upload" className={`${input} mt-0`} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60">
            <ImagePlus className="size-4" /> {uploading ? "Uploading…" : "Upload"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f) }} />
        </div>
      </div>
      <div>
        <label htmlFor="excerpt" className="text-xs font-medium text-muted-foreground">Excerpt (used for search results and sharing)</label>
        <textarea id="excerpt" name="excerpt" rows={2} maxLength={200} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={input} />
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
