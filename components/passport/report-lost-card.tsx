"use client"

import { useState, useTransition } from "react"
import { ShieldAlert, CheckCircle2 } from "lucide-react"
import { reportLostStolen, resolveReport } from "@/app/actions/lost-reports"

export function ReportLostCard({ assetId, openReport }: { assetId: string; openReport: { id: string; kind: string } | null }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (openReport) {
    return (
      <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-destructive" />
          <h2 className="font-semibold text-ink">Reported {openReport.kind}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Anyone who checks this item will see the report. Sharing and transfers are blocked until you resolve it.
        </p>
        <button
          disabled={pending}
          onClick={() => start(async () => { try { await resolveReport(openReport.id, assetId) } catch (e) { setError(e instanceof Error ? e.message : "Could not resolve") } })}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" /> {pending ? "Saving…" : "I found it, resolve report"}
        </button>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-semibold text-ink">Lost or stolen?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Flag it so buyers who check its serial or Ownx ID are warned. This also revokes share links and cancels pending transfers.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-muted">
          Report lost or stolen
        </button>
      ) : (
        <form
          className="mt-4 space-y-3"
          action={(fd) => start(async () => { setError(null); try { await reportLostStolen(assetId, fd); setOpen(false) } catch (e) { setError(e instanceof Error ? e.message : "Could not file report") } })}
        >
          <div className="flex gap-4 text-sm text-ink">
            <label className="inline-flex items-center gap-2"><input type="radio" name="kind" value="lost" defaultChecked /> Lost</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="kind" value="stolen" /> Stolen</label>
          </div>
          <textarea name="details" rows={2} maxLength={500} placeholder="Optional: where and when. Don't include personal contact details; this is not shown publicly."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-destructive px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
              {pending ? "Filing…" : "File report"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
