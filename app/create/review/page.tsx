"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Camera, X } from "lucide-react"
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

// Photo picker for the asset's cover image. Uploads to the public
// "asset-photos" Storage bucket the moment a file is chosen (not on form
// submit), then hands the resulting public URL to the parent through
// onUploaded so the hidden `image_url` field can be populated before the
// server action runs. Public bucket is intentional: this image also needs
// to render on unauthenticated pages (/p/[slug], /share/[slug]).
function PhotoPicker({
  assetId,
  initialUrl,
  onUploaded,
}: {
  assetId: string
  initialUrl: string | null
  onUploaded: (url: string | null) => void
}) {
  const [preview, setPreview] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Session expired — please log in again.")

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const path = `${user.id}/${assetId}/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage.from("asset-photos").upload(path, file, {
        contentType: file.type,
        upsert: true,
      })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from("asset-photos").getPublicUrl(path)
      onUploaded(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. You can still save without one.")
      setPreview(initialUrl)
      onUploaded(initialUrl)
    } finally {
      setUploading(false)
    }
  }

  function clear() {
    setPreview(null)
    setError(null)
    onUploaded(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <label className="text-xs font-medium text-muted-foreground">Photo (optional)</label>
      <div className="mt-2 flex items-center gap-4">
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Asset preview"
              className={cn("size-24 rounded-xl border border-border object-cover", uploading && "opacity-50")}
            />
            <button
              type="button"
              onClick={clear}
              disabled={uploading}
              className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-white shadow-sm disabled:opacity-60"
              aria-label="Remove photo"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-brand/50 hover:text-ink">
            <Camera className="size-5" />
            <span className="text-[10px] font-medium">Add photo</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </label>
        )}
        <div className="text-xs text-muted-foreground">
          {uploading ? "Uploading…" : "JPG, PNG or WEBP. Shown on your passport and any listing you create."}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
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
  const [imageUrl, setImageUrl] = useState<string | null>(null)

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
          setImageUrl((data as Asset).image_url)
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
        <input type="hidden" name="image_url" value={imageUrl || ""} />

        <PhotoPicker assetId={assetId} initialUrl={asset.image_url} onUploaded={setImageUrl} />

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
          {/* FIX: this was missing its opening `<a` tag entirely (only the
              attributes and children were present), which does not compile —
              `href`/`className` as bare JSX expressions followed by a
              dangling `</a>` is a syntax error. Using next/link since this is
              an internal route. */}
          <Link
            href="/create/upload"
            className="rounded-full border border-border px-6 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            Start Over
          </Link>
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
