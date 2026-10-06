import Link from "next/link"
import { ArrowRight, Link2, Copy } from "lucide-react"
import { PassportCard } from "@/components/passport-card"

// Kept under its old name so app/page.tsx needs no change. Resale is paused,
// so this now promotes read-only passport sharing, which is live.
export function ResaleCta() {
  return (
    <section className="bg-brand-soft/50">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Show the proof when you need it.
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Send a read-only link to an insurer, a repair shop or a family member. They see the warranty and service
            history, never your invoices. Hand the passport to a new owner when the time comes.
          </p>

          <div className="mt-6 flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">ownx.io/share/macbook-pro-14-…</span>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-medium text-white">
              <Copy className="size-3.5" /> Copy link
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5"
            >
              Create a passport <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/tools/device-advisor"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-muted"
            >
              Try the device advisor
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
