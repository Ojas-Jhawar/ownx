import type { ReactNode } from "react"
import { AdSlot } from "./ad-slot"

// Desktop-only (xl breakpoint+) two-column layout: content + a sticky 300px
// right rail. Below xl it's just the content — no layout shift, no ad, so it
// never costs mobile users anything. Use only on marketing/content pages
// (blog, marketplace, tools) — never inside create/login/checkout-like flows.
export function PageWithAdRail({
  children,
  adSlot,
}: {
  children: ReactNode
  adSlot: string
}) {
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">{children}</div>
      <aside className="hidden xl:block">
        <div className="sticky top-24 space-y-4">
          <AdSlot adSlot={`${adSlot}-rail-1`} height={250} />
          <AdSlot adSlot={`${adSlot}-rail-2`} height={600} />
        </div>
      </aside>
    </div>
  )
}
