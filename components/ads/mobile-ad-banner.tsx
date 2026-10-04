"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdSlot } from "./ad-slot"

// Fixed, dismissible strip for small screens — the closest web equivalent
// of a native banner ad. Sits above the app's mobile bottom nav when used
// inside AppShell (pass aboveBottomNav), otherwise anchors to the very
// bottom. Dismissal is per-session only (resets on reload) so it isn't
// permanently gone and doesn't nag with a persisted flag across visits.
export function MobileAdBanner({
  adSlot,
  aboveBottomNav = false,
}: {
  adSlot: string
  aboveBottomNav?: boolean
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t border-border bg-card/95 px-3 py-2 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur xl:hidden",
        aboveBottomNav ? "bottom-16" : "bottom-0",
      )}
    >
      <div className="mx-auto flex max-w-md items-center gap-2">
        <div className="min-w-0 flex-1">
          <AdSlot adSlot={adSlot} height={56} className="h-14" />
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss ad"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
