import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const staticPaths = ["", "/how-it-works", "/features", "/about", "/blog", "/tools/device-advisor", "/marketplace", "/privacy", "/terms", "/check", "/tools/scrap-value"]

  let posts: { slug: string; published_at: string | null }[] = []
  try {
    const supabase = await createClient()
    const { data } = await supabase.from("blog_posts").select("slug, published_at").eq("status", "published")
    posts = data || []
  } catch {
    // Build without DB access: ship the static routes only.
  }

  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const })),
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.published_at ? new Date(p.published_at) : undefined,
    })),
  ]
}
