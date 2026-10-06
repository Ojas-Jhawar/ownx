import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-5 py-16 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            Draft for review. Have a lawyer check this against the DPDP Act, 2023 before launch.
          </p>
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
