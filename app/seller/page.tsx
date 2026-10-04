"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Store, Search, Send, ArrowRight } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { lookupDeviceByOwnxId, recordSale } from "@/app/actions/devices"

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

  async function handleSale(fd: FormData) {
    setError(null)
    try {
      await recordSale(device.id, fd)
      setNotice(`Sale recorded — an invitation was sent to ${fd.get("to_email")}.`)
      setDevice({ ...device, status: "sold" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record sale")
    }
  }

  return (
    <AppShell active="Business">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <Store className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Seller dashboard</h1>
            <p className="text-sm text-muted-foreground">Find a device by its Ownx ID and record a sale.</p>
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
        {notice && <p className="mt-3 text-sm text-brand">{notice}</p>}

        {device && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold text-ink">{device.product_name}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{device.ownx_id}</span> · Made by {device.organizations?.name || "Unknown"} ·{" "}
              <span className="capitalize">{device.status}</span>
            </p>

            {device.status === "sold" || device.status === "active" ? (
              <p className="mt-4 text-sm text-muted-foreground">
                This device already has an owner or a pending sale.{" "}
                <Link href={`/device/${device.ownx_id}`} className="font-medium text-brand hover:underline">
                  View passport <ArrowRight className="inline size-3" />
                </Link>
              </p>
            ) : (
              <form action={handleSale} className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Buyer&apos;s email</label>
                  <input
                    name="to_email"
                    type="email"
                    required
                    placeholder="buyer@example.com"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sale price (₹)</label>
                  <input
                    name="sale_price"
                    type="number"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
                  <input
                    name="note"
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground"
                >
                  <Send className="size-4" /> Record sale &amp; invite buyer
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}