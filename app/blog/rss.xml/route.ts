import { createClient } from "@/lib/supabase/server"

export const revalidate = 3600

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!)

export async function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")
  const supabase = await createClient()
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30)

  const items = (data || [])
    .map(
      (p) => `<item><title>${esc(p.title)}</title><link>${site}/blog/${p.slug}</link><guid>${site}/blog/${p.slug}</guid>${
        p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ""
      }<description>${esc(p.excerpt || "")}</description></item>`,
    )
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Ownx Blog</title><link>${site}/blog</link><description>Buying guides, maintenance tips and sustainability notes.</description>${items}</channel></rss>`
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } })
}
