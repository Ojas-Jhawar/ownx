import { redirect } from "next/navigation"
import Image from "next/image"
import { ArrowRightLeft } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"
import { TransferActions } from "@/components/transfers/transfer-actions"
import type { Asset, OwnershipTransfer } from "@/lib/types"

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // RLS ("Recipient can view transfers addressed to them") already scopes
  // the incoming query to rows whose to_email matches this user's login
  // email, so no extra filter is needed here.
  const [{ data: profile }, { data: incomingRaw }, { data: outgoingRaw }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("ownership_transfers")
      .select("*")
      .eq("status", "pending")
      .neq("from_user_id", user.id) // exclude the ones this user sent — those show in "Outgoing" below
      .order("created_at", { ascending: false }),
    supabase.from("ownership_transfers").select("*").eq("from_user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }),
  ])

  const incoming = (incomingRaw as OwnershipTransfer[]) || []
  const outgoing = (outgoingRaw as OwnershipTransfer[]) || []
  const assetIds = Array.from(new Set([...incoming, ...outgoing].map((t) => t.asset_id)))

  const { data: assetsRaw } = assetIds.length
    ? await supabase.from("assets").select("id, product_name, brand, image_url").in("id", assetIds)
    : { data: [] as Pick<Asset, "id" | "product_name" | "brand" | "image_url">[] }
  const assetById = new Map((assetsRaw || []).map((a) => [a.id, a]))

  return (
    <AppShell active="Transfers" userName={profile?.full_name || undefined} userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Ownership Transfers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Passports someone sent you, and ones you've sent out.</p>
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-ink">Incoming</h2>
          {incoming.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nothing waiting for you right now.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {incoming.map((t) => {
                const asset = assetById.get(t.asset_id)
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={asset?.image_url || "/images/product-laptop.png"}
                        alt={asset?.product_name || "Asset"}
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{asset?.product_name || "Untitled asset"}</p>
                      <p className="text-xs text-muted-foreground">Sent {formatDate(t.created_at)}{t.note ? ` · "${t.note}"` : ""}</p>
                    </div>
                    <TransferActions transferId={t.id} mode="incoming" />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">Outgoing</h2>
          {outgoing.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              You haven't sent any passports out.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {outgoing.map((t) => {
                const asset = assetById.get(t.asset_id)
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={asset?.image_url || "/images/product-laptop.png"}
                        alt={asset?.product_name || "Asset"}
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{asset?.product_name || "Untitled asset"}</p>
                      <p className="text-xs text-muted-foreground">To {t.to_email} · sent {formatDate(t.created_at)}</p>
                    </div>
                    <TransferActions transferId={t.id} mode="outgoing" assetId={t.asset_id} />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowRightLeft className="size-3.5" /> Accepting a transfer moves the passport to your account and revokes
          the previous owner's listing and share links.
        </p>
      </div>
    </AppShell>
  )
}
