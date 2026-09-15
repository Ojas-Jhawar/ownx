"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { FlowShell } from "@/components/flow/flow-shell"
import { createClient } from "@/lib/supabase/client"
import { confirmAsset } from "@/app/actions/assets"
import type { Asset } from "@/lib/types"
import { cn } from "@/lib/utils"

type Confidence = Record<string, "high" | "medium" | "low">

function ConfidenceBadge({ level }: { level?: "high" | "medium" | "low" }) {
  if (!level || level === "high") return null
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        level === "medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700",
      )}
    >
      <AlertCircle className="size-3" /> please verify
    </span>
  )
}

function LabeledInput({
  id,
  name,
  label,
  defaultValue,
  type = "text",
  confidence,
  required = false,
}: {
  id: string
  name: string
  label: string
  defaultValue?: string | number | null
  type?: string
  confidence?: "high" | "medium" | "low"
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center text-xs font-medium text-muted-foreground">
        {label}
        <ConfidenceBadge level={confidence} />
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  )
}

function ReviewContent() {
  const searchParams = useSearchParams()
  const assetId = searchParams.get("assetId") || ""
  const mode = searchParams.get("mode") === "manual" ? "manual" : "ai"

  const [asset, setAsset] = useState<Asset | null>(null)
  const [confidence, setConfidence] = useState<Confidence>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assetId) {
      setError("Missing passport draft. Please start again.")
      setLoading(false)
      return
    }
    const supabase = createClient()
    supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) {
          setError("Could not load this draft. Please start again.")
        } else {
          setAsset(data as Asset)
          setConfidence((data.extraction_confidence as Confidence) || {})
        }
        setLoading(false)
      })
  }, [assetId])

  if (loading) {
    return (
      <FlowShell currentStep={3} backHref="/create/upload">
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      </FlowShell>
    )
  }

  if (error || !asset) {
    return (
      <FlowShell currentStep={3} backHref="/create/upload">
        <p className="text-center text-sm text-destructive">{error}</p>
      </FlowShell>
    )
  }

  const boundConfirm = confirmAsset.bind(null, assetId)

  return (
    <FlowShell currentStep={3} backHref={mode === "manual" ? "/create" : "/create/processing"}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {mode === "manual" ? "Enter your asset details" : "Review your asset details"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "manual"
            ? "Fill in what you know — you can always edit this later."
            : "Make sure everything looks right. Fields we're unsure about are flagged."}
        </p>
      </div>

      <form action={boundConfirm} className="mt-6 space-y-5">
        <input type="hidden" name="extraction_source" value={mode} />

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledInput
              id="product_name"
              name="product_name"
              label="Product"
              defaultValue={asset.product_name}
              confidence={confidence.product_name}
              required
            />
            <LabeledInput id="brand" name="brand" label="Brand" defaultValue={asset.brand} confidence={confidence.brand} />
            <LabeledInput
              id="category"
              name="category"
              label="Category"
              defaultValue={asset.category}
              confidence={confidence.category}
            />
            <LabeledInput
              id="serial_number"
              name="serial_number"
              label="Serial number"
              defaultValue={asset.serial_number}
              confidence={confidence.serial_number}
            />
            <LabeledInput
              id="purchase_date"
              name="purchase_date"
              label="Purchase date"
              type="date"
              defaultValue={asset.purchase_date}
              confidence={confidence.purchase_date}
            />
            <LabeledInput
              id="purchase_price"
              name="purchase_price"
              label="Purchase price (₹)"
              type="number"
              defaultValue={asset.purchase_price}
              confidence={confidence.purchase_price}
            />
            <LabeledInput
              id="warranty_months"
              name="warranty_months"
              label="Warranty (months)"
              type="number"
              defaultValue={asset.warranty_months}
              confidence={confidence.warranty_months}
            />
            <LabeledInput
              id="condition_score"
              name="condition_score"
              label="Condition score (0–100)"
              type="number"
              defaultValue={asset.condition_score ?? 90}
            />
          </div>
          <input type="hidden" name="currency" value="INR" />
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="/create/upload"
            className="rounded-full border border-border px-6 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            Start Over
          </a>
          <button
            type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-center text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5"
          >
            Confirm &amp; Create Passport
          </button>
        </div>
      </form>
    </FlowShell>
  )
}
