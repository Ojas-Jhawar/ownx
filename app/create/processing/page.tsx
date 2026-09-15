"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, FileText, ArrowRight, AlertTriangle } from "lucide-react"
import { FlowShell } from "@/components/flow/flow-shell"
import { cn } from "@/lib/utils"
import { runExtraction } from "@/app/actions/assets"
import type { InvoiceExtraction } from "@/lib/types"

const CHECK_FIELDS: { key: keyof InvoiceExtraction; label: string }[] = [
  { key: "product_name", label: "Product identified" },
  { key: "serial_number", label: "Serial number found" },
  { key: "purchase_date", label: "Purchase date found" },
  { key: "warranty_months", label: "Warranty found" },
]

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assetId = searchParams.get("assetId") || ""
  const path = searchParams.get("path") || ""
  const name = searchParams.get("name") || "invoice"
  const type = searchParams.get("type") || "application/octet-stream"

  const [progress, setProgress] = useState(8)
  const [result, setResult] = useState<InvoiceExtraction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!assetId || !path) {
      router.replace("/create/upload")
      return
    }
    if (started.current) return
    started.current = true

    // Animate up to ~92% while the real request is in flight; we don't know
    // the true progress of a single API call, so this is a UX affordance —
    // completion (100%) and the checklist below only reflect real results.
    const tick = setInterval(() => setProgress((v) => (v >= 92 ? 92 : v + Math.random() * 6)), 300)

    runExtraction({ assetId, storagePath: path, mimeType: type, fileName: name })
      .then((extraction) => {
        clearInterval(tick)
        setProgress(100)
        setResult(extraction)
      })
      .catch((err) => {
        clearInterval(tick)
        setError(err instanceof Error ? err.message : "Extraction failed")
      })

    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, path])

  const done = result !== null

  return (
    <FlowShell currentStep={2} backHref="/create/upload">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {error ? "Extraction had trouble" : done ? "All set!" : "Analyzing your invoice…"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ? "You can still enter the details yourself." : "This may take a few seconds."}
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="size-4 text-brand" /> {name}
          </div>
          <div className="mt-3 space-y-2" aria-hidden="true">
            <div className="h-2.5 w-3/4 rounded bg-muted" />
            <div className="h-2.5 w-full rounded bg-muted" />
            <div className="h-2.5 w-5/6 rounded bg-muted" />
            <div className="h-2.5 w-2/3 rounded bg-muted" />
          </div>
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300 ease-out",
                  error ? "bg-destructive" : "bg-brand",
                )}
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        </div>

        <ul className="space-y-3">
          {CHECK_FIELDS.map(({ key, label }) => {
            const field = result?.[key]
            const found = !!field && field.value !== null && field.confidence !== "low"
            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                  found ? "border-brand/30 bg-brand-soft/60 text-ink" : "border-border bg-card text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full transition-colors",
                    found ? "bg-brand text-brand-foreground" : "border border-border",
                  )}
                >
                  {found && <Check className="size-3" />}
                </span>
                {label}
              </li>
            )
          })}
        </ul>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-ink">{error}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No problem — you can fill in the details yourself instead.
            </p>
            <button
              onClick={() => router.push(`/create/review?assetId=${assetId}&mode=manual`)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted"
            >
              Enter details manually <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "mt-6 rounded-2xl border border-brand/30 bg-brand-soft/60 p-5 transition-opacity duration-500",
          done && !error ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-brand text-brand-foreground">
            <Check className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-ink">Passport ready!</p>
            <p className="text-sm text-muted-foreground">
              We&apos;ve extracted what we could from your invoice — please double-check it on the next screen.
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/create/review?assetId=${assetId}`)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5"
        >
          Review details <ArrowRight className="size-4" />
        </button>
      </div>
    </FlowShell>
  )
}
