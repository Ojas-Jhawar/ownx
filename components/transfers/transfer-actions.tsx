"use client"

import { useState, useTransition } from "react"
import { Check, X } from "lucide-react"
import { acceptTransfer, declineTransfer, cancelTransfer } from "@/app/actions/transfers"

export function TransferActions({
  transferId,
  mode,
  assetId,
}: {
  transferId: string
  mode: "incoming" | "outgoing"
  assetId?: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (mode === "outgoing") {
    return (
      <div className="shrink-0">
        <button
          onClick={() =>
            startTransition(async () => {
              try {
                await cancelTransfer(transferId, assetId!)
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not cancel")
              }
            })
          }
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted disabled:opacity-60"
        >
          <X className="size-3.5" /> {pending ? "Cancelling…" : "Cancel"}
        </button>
        {error && <p className="mt-1 text-right text-[11px] text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={() =>
          startTransition(async () => {
            try {
              await acceptTransfer(transferId)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not accept")
            }
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-60"
      >
        <Check className="size-3.5" /> Accept
      </button>
      <button
        onClick={() =>
          startTransition(async () => {
            try {
              await declineTransfer(transferId)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not decline")
            }
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted disabled:opacity-60"
      >
        <X className="size-3.5" /> Decline
      </button>
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
