"use client"

import { useActionState } from "react"
import { Search, ShieldAlert, CircleCheck, CircleHelp } from "lucide-react"
import { checkItem, type CheckState } from "@/app/actions/check"
import { VerificationBadge } from "@/components/verification/verification-badge"

const initial: CheckState = { error: null }

export function CheckForm() {
  const [state, action, pending] = useActionState(checkItem, initial)
  const r = state.result

  return (
    <div className="mx-auto max-w-xl">
      <form action={action} className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4">
        <label htmlFor="query" className="sr-only">Ownx ID, serial number or IMEI</label>
        <input
          id="query" name="query" required minLength={5} maxLength={64} defaultValue={state.query}
          placeholder="OWNX-XXXXXXXX, serial number or IMEI"
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:font-sans placeholder:text-muted-foreground"
        />
        <button type="submit" disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60">
          <Search className="size-4" /> {pending ? "Checking…" : "Check item"}
        </button>
      </form>

      {state.error && <p role="alert" className="mt-3 text-center text-sm text-destructive">{state.error}</p>}

      {r && r.reported && (
        <div role="status" className="mt-6 flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-ink">Reported {r.reported} by its owner</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Don&apos;t buy or accept this item. If you hold it, contact the seller or local police.
            </p>
          </div>
        </div>
      )}

      {r && !r.reported && r.found && (
        <div role="status" className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                {r.product_name ? `${r.product_name}${r.brand ? ` (${r.brand})` : ""}` : "Item found on Ownx"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">No lost or stolen report is open for this item.</p>
              <div className="mt-3"><VerificationBadge status={r.verification || "unverified"} /></div>
            </div>
          </div>
        </div>
      )}

      {r && !r.found && (
        <div role="status" className="mt-6 flex gap-3 rounded-2xl border border-dashed border-border bg-card p-5">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing on Ownx matches that. That doesn&apos;t prove the item is clean. It means nobody has registered it here.
          </p>
        </div>
      )}
    </div>
  )
}
