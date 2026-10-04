"use client"

import { useState, useTransition } from "react"
import { Check, X } from "lucide-react"
import { acceptDeviceTransfer, declineDeviceTransfer } from "@/app/actions/devices"

export function DeviceTransferActions({ transferId }: { transferId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={() => startTransition(() => acceptDeviceTransfer(transferId).catch((e) => setError(e.message)))}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-60"
      >
        <Check className="size-3.5" /> Accept
      </button>
      <button
        onClick={() => startTransition(() => declineDeviceTransfer(transferId).catch((e) => setError(e.message)))}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted disabled:opacity-60"
      >
        <X className="size-3.5" /> Decline
      </button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}