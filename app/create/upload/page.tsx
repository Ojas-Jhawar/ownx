"use client"

import { useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { UploadCloud, ShieldCheck, ArrowLeft, ArrowRight, FileText, X } from "lucide-react"
import { FlowShell } from "@/components/flow/flow-shell"
import { createClient } from "@/lib/supabase/client"
import { createDraftAsset } from "@/app/actions/assets"

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const capture = searchParams.get("capture") === "1"

  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<"ai" | "manual" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  async function startExtraction() {
    if (!file) {
      setError("Choose a file first, or continue manually below.")
      return
    }
    setError(null)
    setBusy("ai")
    try {
      const { assetId } = await createDraftAsset()

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Session expired — please log in again.")

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const path = `${user.id}/${assetId}/${safeName}`

      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type,
        upsert: true,
      })
      if (uploadError) throw uploadError

      const params = new URLSearchParams({
        assetId,
        path,
        name: file.name,
        type: file.type || "application/octet-stream",
      })
      router.push(`/create/processing?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
      setBusy(null)
    }
  }

  async function startManual() {
    setError(null)
    setBusy("manual")
    try {
      const { assetId } = await createDraftAsset()
      router.push(`/create/review?assetId=${assetId}&mode=manual`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a new passport.")
      setBusy(null)
    }
  }

  return (
    <FlowShell currentStep={1} backHref="/create">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Upload your purchase invoice</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ownx will extract the product, serial number, purchase date and warranty details.
        </p>
      </div>

      {!file ? (
        <label className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card px-6 py-14 text-center transition-colors hover:border-brand/50 hover:bg-muted/40">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <UploadCloud className="size-7" />
          </span>
          <p className="mt-4 text-sm font-medium text-ink">
            {capture ? "Take a photo of your invoice" : "Drop your invoice here"}
          </p>
          <p className="my-2 text-xs text-muted-foreground">or</p>
          <span className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground">
            {capture ? "Open camera" : "Browse files"}
          </span>
          <p className="mt-3 text-xs text-muted-foreground">PDF, JPG or PNG</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            capture={capture ? "environment" : undefined}
            onChange={onFileChange}
            className="sr-only"
          />
        </label>
      ) : (
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-ink"
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-ink">Why do we need this?</span> Your invoice helps us verify that the asset
          belongs to you. Files are stored privately and only visible to you.
        </p>
      </div>

      <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => router.push("/create")}
          className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={startManual}
            disabled={busy !== null}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-muted disabled:opacity-60"
          >
            {busy === "manual" ? "Starting…" : "Enter details manually"}
          </button>
          <button
            type="button"
            onClick={startExtraction}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {busy === "ai" ? "Uploading…" : "Extract with AI"} <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </FlowShell>
  )
}
