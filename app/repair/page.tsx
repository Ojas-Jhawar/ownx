"use client"

import { useState, useTransition } from "react"
import { Wrench, Search, ShieldCheck } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { lookupDeviceByOwnxId, addRepairEvent } from "@/app/actions/devices"

export default function Page() {
  const [query, setQuery] = useState("")
  const [device, setDevice] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSearch() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      try {
        const result = await lookupDeviceByOwnxId(query)
        if (!result) {
          setDevice(null)
          setError("No device found with that Ownx ID.")
        } else {
          setDevice(result)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lookup failed")
      }
    })
  }

  async function handleRepair(fd: FormData) {
    setError(null)
    try {
      await addRepairEvent(device.id, fd)
      setNotice("Verified repair added to this device's history.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save repair")
    }
  }

  return (
    <AppShell active="Business">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <Wrench className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Repair shop dashboard</h1>
            <p className="text-sm text-muted-foreground">Locate any device and log a digitally verified repair.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="OWNX-XXXXXXXX"
            className="flex-1 rounded-xl border border-input bg-card px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            onClick={handleSearch}
            disabled={pending || !query}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground disabled:opacity-60"
          >
            <Search className="size-4" /> {pending ? "Searching…" : "Find"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {notice && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-brand">
            <ShieldCheck className="size-4" /> {notice}
          </p>
        )}

        {device && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold text-ink">{device.product_name}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{device.ownx_id}</span> · {[device.brand, device.category].filter(Boolean).join(" · ")}
            </p>

            <form action={handleRepair} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Work performed</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Battery replacement"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Diagnosis / parts / notes</label>
                <textarea
                  name="detail"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cost (₹)</label>
                <input
                  name="cost"
                  type="number"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground"
              >
                <ShieldCheck className="size-4" /> Sign &amp; add verified repair
              </button>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  )
}