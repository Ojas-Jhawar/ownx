import Image from "next/image"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Pill } from "@/components/ui-kit"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"
import { PageWithAdRail } from "@/components/ads/page-with-ad-rail"
import { MobileAdBanner } from "@/components/ads/mobile-ad-banner"

// Public — no login required.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, cover_image_url, content, category, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (!post) notFound()

  // Content is admin-authored plain text — split on blank lines into
  // paragraphs rather than rendering raw HTML, so there's no injection
  // surface even though only admins can write posts today.
  const paragraphs = post.content.split(/\n{2,}/).filter(Boolean)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <PageWithAdRail adSlot="blog-post">
            <div className="max-w-2xl">
              <Pill>{post.category}</Pill>
              <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{formatDate(post.published_at)}</p>

              {post.cover_image_url && (
                <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
                  <Image src={post.cover_image_url} alt={post.title} fill className="object-cover" />
                </div>
              )}

              <div className="prose prose-neutral mt-8 max-w-none space-y-4">
                {paragraphs.map((para, i) => (
                  <p key={i} className="leading-relaxed text-ink-soft">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </PageWithAdRail>
        </article>
      </main>
      <SiteFooter />
      <MobileAdBanner adSlot="blog-post-mobile" />
    </div>
  )
}
