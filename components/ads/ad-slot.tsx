"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

// Thin wrapper around an ad network's script tag. Stubbed for Google
// AdSense — swap the script src / data-ad-* attributes for whatever network
// you actually sign up with. Until NEXT_PUBLIC_ADSENSE_CLIENT is set, this
// renders a quiet labelled placeholder instead of a broken/empty box, so it
// never looks like a layout bug in dev or before you have real ad units.
export function AdSlot({
  adSlot,
  className,
  height = 250,
}: {
  /** Your own name for this placement, e.g. "blog-list-rail" — maps to an ad-unit id you configure with your network. */
  adSlot: string
  className?: string
  height?: number
}) {
  const ref = useRef<HTMLModElement>(null)
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

  useEffect(() => {
    if (!client) return
    try {
      // @ts-expect-error — injected by the AdSense script loaded in layout.tsx
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // Ad blocked or script not loaded yet — fail silently, never break the page.
    }
  }, [client])

  if (!client) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground",
          className,
        )}
        style={{ minHeight: height }}
        aria-hidden="true"
      >
        Ad space ({adSlot})
      </div>
    )
  }

  return (
    <div className={className}>
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Advertisement</span>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block", minHeight: height }}
        data-ad-client={client}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
