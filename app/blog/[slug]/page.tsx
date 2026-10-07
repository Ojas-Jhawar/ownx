import { cache } from "react"
import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Pill } from "@/components/ui-kit"
import { Markdown } from "@/components/markdown"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"
import { PageWithAdRail } from "@/components/ads/page-with-ad-rail"
import { MobileAdBanner } from "@/components/ads/mobile-ad-banner"

const getPost = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("blog_posts")
    .select("title, excerpt, cover_image_url, content, category, published_at, updated_at")
    .eq("slug", slug).eq("status", "published").maybeSingle()
  return data
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return {}
  const images = post.cover_image_url ? [post.cover_image_url] : undefined
  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt || undefined, publishedTime: post.published_at || undefined, images },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt || undefined, images },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const minutes = Math.max(1, Math.round(post.content.split(/\s+/).length / 200))
  const site = process.env.NEXT_PUBLIC_SITE_URL || ""
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org", "@type": "Article",
    headline: post.title, description: post.excerpt || undefined,
    datePublished: post.published_at, dateModified: post.updated_at,
    image: post.cover_image_url || undefined, mainEntityOfPage: `${site}/blog/${slug}`,
    publisher: { "@type": "Organization", name: "Ownx" },
  }).replace(/</g, "\\u003c")

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
          <PageWithAdRail adSlot="blog-post">
            <div className="max-w-2xl">
              <Pill>{post.category}</Pill>
              <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{post.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{formatDate(post.published_at)} · {minutes} min read</p>
              {post.cover_image_url && (
                <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
                  <Image src={post.cover_image_url} alt={post.title} fill className="object-cover" />
                </div>
              )}
              <div className="mt-8"><Markdown>{post.content}</Markdown></div>

              <div className="mt-12 rounded-2xl border border-border bg-brand-soft/50 p-6">
                <p className="font-semibold text-ink">Keep the proof for what you own.</p>
                <p className="mt-1 text-sm text-muted-foreground">Store the invoice, warranty and repairs in one passport, and get a reminder before the warranty ends.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/create" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground">Create a passport</Link>
                  <Link href="/tools/device-advisor" className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink hover:bg-muted">Repair, sell or scrap?</Link>
                </div>
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
