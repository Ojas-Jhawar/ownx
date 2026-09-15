"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Share2, Check, Loader2 } from "lucide-react"
import { createOrGetPassportShare } from "@/app/actions/shares"

export function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Copied!" : "Copy Share Link"}
    </button>
  )
}

// Creates (or reuses) a view-only passport share link on first click, copies
// it, then refreshes the page so the QR code / link card picks it up.
export function PassportShareButton({
  assetId,
  existingUrl,
  siteUrl,
}: {
  assetId: string
  existingUrl: string | null
  siteUrl: string
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (existingUrl) {
      navigator.clipboard.writeText(existingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }
    startTransition(async () => {
      const { slug } = await createOrGetPassportShare(assetId)
      await navigator.clipboard.writeText(`${siteUrl}/share/${slug}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-70"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {pending ? "Creating link…" : copied ? "Copied!" : "Share Passport"}
    </button>
  )
}
