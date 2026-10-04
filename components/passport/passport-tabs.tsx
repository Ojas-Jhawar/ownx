"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, FileText, Download, Plus, Trash2, Send, X, Share2, Check, ShieldOff, History, ShieldCheck, Store, ExternalLink } from "lucide-react"
import { updateAsset } from "@/app/actions/assets"
import { deleteServiceRecord } from "@/app/actions/service"
import { addOwnerNote } from "@/app/actions/devices"
import { ServiceRecordForm } from "@/components/service/service-record-form"
import { AiDiagnose } from "@/components/service/ai-diagnose"
import { initiateTransfer, cancelTransfer } from "@/app/actions/transfers"
import { revokePassportShare } from "@/app/actions/shares"
import { withdrawListing } from "@/app/actions/listings"
import { formatINR, formatDate } from "@/lib/format"
import type { Asset, ServiceRecord, OwnershipTransfer } from "@/lib/types"

const BASE_TABS = ["Overview", "Documents", "Service", "Ownership", "Share"] as const

type DocRow = { id: string; file_name: string | null; kind: string; url: string | null; created_at: string }
type ChainLink = { id: string; fromName: string; toName: string; resolvedAt: string | null }
type ShareInfo = { id: string; slug: string; url: string }
type ListingInfo = { id: string; slug: string; askingPrice: number | null; url: string }
type DeviceInfo = { id: string; ownx_id: string; status: string; warranty_months: number | null; organizations?: { name: string } | null } | null

export function PassportTabs({
  asset,
  documents,
  serviceRecords,
  ownerName,
  pendingTransfer,
  ownershipChain,
  passportShare,
  listing,
  device,
  timeline,
}: {
  asset: Asset
  documents: DocRow[]
  serviceRecords: ServiceRecord[]
  ownerName: string
  pendingTransfer: OwnershipTransfer | null
  ownershipChain: ChainLink[]
  passportShare: ShareInfo | null
  listing?: ListingInfo | null
  device?: DeviceInfo
  timeline?: any[]
}) {
  const TABS = device ? [...BASE_TABS, "Timeline" as const] : BASE_TABS
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview")

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              t === tab
                ? "flex-1 whitespace-nowrap rounded-full bg-brand-soft py-2 text-sm font-medium text-brand"
                : "flex-1 whitespace-nowrap rounded-full py-2 text-sm font-medium text-muted-foreground hover:text-ink"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Overview" && <OverviewTab asset={asset} />}
        {tab === "Documents" && <DocumentsTab documents={documents} />}
        {tab === "Service" && <ServiceTab asset={asset} records={serviceRecords} documents={documents} />}
        {tab === "Ownership" && (
          <OwnershipTab asset={asset} ownerName={ownerName} pendingTransfer={pendingTransfer} chain={ownershipChain} />
        )}
        {tab === "Share" && <ShareTab asset={asset} share={passportShare} listing={listing || null} />}
        {tab === "Timeline" && device && <TimelineTab device={device} timeline={timeline || []} />}
      </div>
    </div>
  )
}

function OverviewTab({ asset }: { asset: Asset }) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const boundUpdate = updateAsset.bind(null, asset.id)

  if (editing) {
    return (
      <form
        action={(fd) => startTransition(async () => {
          await boundUpdate(fd)
          setEditing(false)
        })}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <h2 className="font-semibold text-ink">Edit details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="e-product" name="product_name" label="Product" defaultValue={asset.product_name} />
          <Field id="e-brand" name="brand" label="Brand" defaultValue={asset.brand} />
          <Field id="e-serial" name="serial_number" label="Serial number" defaultValue={asset.serial_number} />
          <Field id="e-date" name="purchase_date" label="Purchase date" type="date" defaultValue={asset.purchase_date} />
          <Field id="e-price" name="purchase_price" label="Purchase price (₹)" type="number" defaultValue={asset.purchase_price} />
          <Field id="e-warranty" name="warranty_months" label="Warranty (months)" type="number" defaultValue={asset.warranty_months} />
          <Field id="e-condition" name="condition_score" label="Condition (0–100)" type="number" defaultValue={asset.condition_score} />
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  const DETAILS: [string, string][] = [
    ["Serial number", asset.serial_number || "—"],
    ["Purchase date", formatDate(asset.purchase_date)],
    ["Purchase price", formatINR(asset.purchase_price)],
    ["Warranty", asset.warranty_months ? `${asset.warranty_months} months` : "—"],
    ["Condition", asset.condition_score !== null ? `${asset.condition_score} / 100` : "Not rated"],
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Product details</h2>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      </div>
      <dl className="mt-2 divide-y divide-border">
        {DETAILS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Field({
  id,
  name,
  label,
  defaultValue,
  type = "text",
}: {
  id: string
  name: string
  label: string
  defaultValue?: string | number | null
  type?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  )
}

function DocumentsTab({ documents }: { documents: DocRow[] }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No documents attached yet.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {documents.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{d.file_name || "Document"}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {d.kind.replace("_", " ")} · {formatDate(d.created_at)}
            </p>
          </div>
          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-ink"
              aria-label="Download"
            >
              <Download className="size-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function ServiceTab({ asset, records, documents }: { asset: Asset; records: ServiceRecord[]; documents: DocRow[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()
  const docById = new Map(documents.map((d) => [d.id, d]))

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No service history logged yet.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const receipt = r.receipt_document_id ? docById.get(r.receipt_document_id) : null
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.serviced_at)} {r.cost ? `· ${formatINR(r.cost)}` : ""}
                    {r.performed_by ? ` · by ${r.performed_by}` : ""}
                  </p>
                  {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
                  {receipt?.url && (
                    <a
                      href={receipt.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      <FileText className="size-3" /> View receipt
                    </a>
                  )}
                </div>
                <button
                  onClick={() => startTransition(() => deleteServiceRecord(r.id, asset.id))}
                  disabled={pending}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label="Delete record"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showForm ? (
        <ServiceRecordForm assets={[{ id: asset.id, product_name: asset.product_name }]} fixedAssetId={asset.id} onDone={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-muted"
        >
          <Plus className="size-4" /> Add service record
        </button>
      )}

      <AiDiagnose assetId={asset.id} category={asset.category} onDone={() => router.refresh()} />

    </div>
  )
}

function OwnershipTab({
  asset,
  ownerName,
  pendingTransfer,
  chain,
}: {
  asset: Asset
  ownerName: string
  pendingTransfer: OwnershipTransfer | null
  chain: ChainLink[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const boundInitiate = initiateTransfer.bind(null, asset.id)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-ink">Ownership history</h2>

        <div className="mt-4 space-y-4">
          {chain.map((link) => (
            <div key={link.id} className="flex items-start gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-ink">
                  {link.fromName} → {link.toName}
                </p>
                <p className="text-xs text-muted-foreground">Transferred {formatDate(link.resolvedAt)}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" />
            <div>
              <p className="text-sm font-medium text-ink">{ownerName} (current owner)</p>
              <p className="text-xs text-muted-foreground">Passport created {formatDate(asset.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-ink">Transfer ownership</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Move this passport to a new owner — a sale, a gift, or handing it down. They'll need an Ownx account with
          the email you send it to.
        </p>

        {pendingTransfer ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Pending transfer to {pendingTransfer.to_email}</p>
              <p className="text-xs text-muted-foreground">Sent {formatDate(pendingTransfer.created_at)} · waiting for them to accept</p>
            </div>
            <button
              onClick={() => startTransition(() => cancelTransfer(pendingTransfer.id, asset.id))}
              disabled={pending}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted"
            >
              <X className="size-3.5" /> Cancel
            </button>
          </div>
        ) : showForm ? (
          <form
            action={(fd) =>
              startTransition(async () => {
                setError(null)
                try {
                  await boundInitiate(fd)
                  setShowForm(false)
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not start transfer")
                }
              })
            }
            className="mt-4 space-y-3"
          >
            <div>
              <label htmlFor="to_email" className="text-xs font-medium text-muted-foreground">
                Recipient's email
              </label>
              <input
                id="to_email"
                name="to_email"
                type="email"
                required
                placeholder="friend@example.com"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label htmlFor="note" className="text-xs font-medium text-muted-foreground">
                Note (optional)
              </label>
              <input
                id="note"
                name="note"
                placeholder="e.g. Here's the laptop I promised you!"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
              >
                <Send className="size-3.5" /> {pending ? "Sending…" : "Send transfer request"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground"
          >
            <Send className="size-4" /> Transfer to someone
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Have an incoming transfer waiting for you?{" "}
        <Link href="/transfers" className="font-medium text-brand hover:underline">
          Check /transfers →
        </Link>
      </p>
    </div>
  )
}

function ShareTab({ asset, share, listing }: { asset: Asset; share: ShareInfo | null; listing: ListingInfo | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [listingCopied, setListingCopied] = useState(false)
  const [withdrawing, startWithdraw] = useTransition()

  return (
    <div className="space-y-4">
      {/* Previously: a listing created via /resale/[id] had no control surface
          anywhere in the app once live — withdrawListing() existed as a
          server action but nothing called it. This card is that control. */}
      {listing && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Store className="size-4 text-brand" />
            <h2 className="font-semibold text-ink">Active marketplace listing</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            This passport is currently listed for resale at{" "}
            <span className="font-medium text-ink">{formatINR(listing.askingPrice)}</span>.
          </p>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{listing.url}</span>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(listing.url)
                  setListingCopied(true)
                  setTimeout(() => setListingCopied(false), 2000)
                }}
                className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
              >
                {listingCopied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}{" "}
                {listingCopied ? "Copied" : "Copy"}
              </button>
              <a
                href={listing.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted"
              >
                <ExternalLink className="size-3.5" /> View
              </a>
            </div>
          </div>
          <button
            onClick={() =>
              startWithdraw(async () => {
                await withdrawListing(listing.id, asset.id)
                router.refresh()
              })
            }
            disabled={withdrawing}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-ink hover:bg-muted disabled:opacity-60"
          >
            <ShieldOff className="size-3.5" /> {withdrawing ? "Withdrawing…" : "Withdraw listing"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-brand" />
          <h2 className="font-semibold text-ink">Share this passport</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          A read-only link — anyone who opens it sees verified details and service history, but nothing private like
          your invoices. Not a for-sale listing.
        </p>

        {share ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{share.url}</span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(share.url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
              >
                {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              onClick={() =>
                startTransition(async () => {
                  await revokePassportShare(share.id, asset.id)
                  router.refresh()
                })
              }
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-ink hover:bg-muted disabled:opacity-60"
            >
              <ShieldOff className="size-3.5" /> {pending ? "Revoking…" : "Revoke link"}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Use the <span className="font-medium text-ink">Share Passport</span> button above to create your link.
          </p>
        )}
      </div>
    </div>
  )
}



const STATUS_TONE: Record<string, string> = {
  reported: "bg-muted text-muted-foreground",
  documented: "bg-amber-500/10 text-amber-600",
  verified: "bg-brand-soft text-brand",
  confirmed: "bg-emerald-500/10 text-emerald-600",
}

function TimelineTab({ device, timeline }: { device: NonNullable<DeviceInfo>; timeline: any[] }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand" />
          <h2 className="font-semibold text-ink">Manufacturer-grade lifecycle</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{device.ownx_id}</span> · {device.organizations?.name && `Made by ${device.organizations.name}`}
        </p>

        <div className="mt-4 space-y-2">
          {timeline.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-background p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{e.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_TONE[e.status]}`}>
                  {e.status}
                </span>
              </div>
              {e.detail && <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(e.created_at)} {e.organizations?.name ? `· ${e.organizations.name}` : ""}
              </p>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-ink">Add a note</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Owner notes are logged as <span className="font-medium">Reported</span> — only manufacturers and repair
          shops can add Verified/Confirmed events.
        </p>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <form
          action={(fd) =>
            startTransition(async () => {
              setError(null)
              try {
                await addOwnerNote(device.id, fd)
                router.refresh()
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not add note")
              }
            })
          }
          className="mt-3 space-y-2"
        >
          <input
            name="title"
            required
            placeholder="e.g. Added a leather case"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <textarea
            name="detail"
            rows={2}
            placeholder="Optional details"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
          >
            <History className="mr-1.5 inline size-3.5" /> {pending ? "Saving…" : "Add note"}
          </button>
        </form>
      </div>
    </div>
  )
}
