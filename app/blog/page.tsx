import Link from "next/link"
import Image from "next/image"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Eyebrow, Pill } from "@/components/ui-kit"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"
import { PageWithAdRail } from "@/components/ads/page-with-ad-rail"
import { MobileAdBanner } from "@/components/ads/mobile-ad-banner"

// Public — no login required.
export default async function Page() {
  const supabase = await createClient()
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, cover_image_url, category, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <Eyebrow>Ownx Blog</Eyebrow>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Buying guides, maintenance tips, and sustainability notes.
          </h1>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <PageWithAdRail adSlot="blog-list">
            {!posts || posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                No posts published yet — check back soon.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {posts.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-brand/40"
                  >
                    {p.cover_image_url && (
                      <div className="relative aspect-[16/9] bg-muted">
                        <Image src={p.cover_image_url} alt={p.title} fill className="object-cover" />
                      </div>
                    )}
                    <div className="p-5">
                      <Pill>{p.category}</Pill>
                      <h2 className="mt-3 font-semibold text-ink">{p.title}</h2>
                      {p.excerpt && <p className="mt-1.5 text-sm text-muted-foreground">{p.excerpt}</p>}
                      <p className="mt-3 text-xs text-muted-foreground">{formatDate(p.published_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </PageWithAdRail>
        </section>
      </main>
      <SiteFooter />
      <MobileAdBanner adSlot="blog-list-mobile" />
    </div>
  )
}
