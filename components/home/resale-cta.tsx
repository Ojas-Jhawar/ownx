import Link from "next/link"
import { ArrowRight, Link2, Copy } from "lucide-react"
import { PassportCard } from "@/components/passport-card"

export function ResaleCta() {
  return (
    <section className="bg-brand-soft/50">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Ready for its next owner?</h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Share a verified history instead of asking buyers to take your word for it. Transfer ownership in a tap.
          </p>

          <div className="mt-6 flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">ownx.io/p/macbook-pro-14-x9f2</span>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-medium text-white"
            >
              <Copy className="size-3.5" /> Copy Link
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5"
            >
              View Your Passport <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-muted"
            >
              List for Resale
            </Link>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PassportCard />
        </div>
      </div>
    </section>
  )
}
