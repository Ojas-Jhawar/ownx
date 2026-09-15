"use client"

import { useRef, useState, useTransition } from "react"
import { Plus, Paperclip, X } from "lucide-react"
import { addServiceRecord } from "@/app/actions/service"
import { createClient } from "@/lib/supabase/client"

export function ServiceRecordForm({
  assets,
  fixedAssetId,
  onDone,
}: {
  assets: { id: string; product_name: string | null }[]
  /** When set (e.g. embedded in a single passport's page), the asset picker is hidden. */
  fixedAssetId?: string
  onDone?: () => void
}) {
  const [open, setOpen] = useState(!fixedAssetId ? false : true)
  const [pending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!fixedAssetId && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground"
      >
        <Plus className="size-4" /> Log a service record
      </button>
    )
  }

  async function handleSubmit(fd: FormData) {
    setError(null)
    const assetId = fixedAssetId || String(fd.get("asset_id") || "")
    if (!assetId) {
      setError("Choose an asset")
      return
    }

    try {
      if (file) {
        setUploading(true)
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Session expired — please log in again.")

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${user.id}/${assetId}/service/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
          contentType: file.type,
          upsert: true,
        })
        if (uploadError) throw uploadError

        fd.set("receipt_path", path)
        fd.set("receipt_name", file.name)
        fd.set("receipt_mime", file.type || "application/octet-stream")
        setUploading(false)
      }
      if (fixedAssetId) fd.set("asset_id", fixedAssetId)

      startTransition(async () => {
        await addServiceRecord(fd)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
        if (fixedAssetId) onDone?.()
        else setOpen(false)
      })
    } catch (err) {
      setUploading(false)
      setError(err instanceof Error ? err.message : "Could not save this record.")
    }
  }

  const busy = pending || uploading

  return (
    <form action={handleSubmit} className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {!fixedAssetId && (
          <div className="sm:col-span-2">
            <label htmlFor="asset_id" className="text-xs font-medium text-muted-foreground">
              Asset
            </label>
            <select
              id="asset_id"
              name="asset_id"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.product_name || "Untitled asset"}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="title" className="text-xs font-medium text-muted-foreground">
            What was done
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="e.g. Battery replacement"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label htmlFor="performed_by" className="text-xs font-medium text-muted-foreground">
            Performed by
          </label>
          <input
            id="performed_by"
            name="performed_by"
            placeholder="e.g. Apple Store Koramangala"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label htmlFor="serviced_at" className="text-xs font-medium text-muted-foreground">
            Date
          </label>
          <input
            id="serviced_at"
            name="serviced_at"
            type="date"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div>
          <label htmlFor="cost" className="text-xs font-medium text-muted-foreground">
            Cost (₹)
          </label>
          <input
            id="cost"
            name="cost"
            type="number"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">Receipt (optional)</label>
        {file ? (
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
              className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-ink"
              aria-label="Remove file"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:border-brand/50 hover:text-ink">
            <Paperclip className="size-3.5" />
            Attach a bill or receipt
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
        >
          {uploading ? "Uploading…" : pending ? "Saving…" : "Save record"}
        </button>
        <button
          type="button"
          onClick={() => (fixedAssetId ? onDone?.() : setOpen(false))}
          className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
