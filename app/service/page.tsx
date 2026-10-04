import { redirect } from "next/navigation"
import Link from "next/link"
import { Wrench } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatINR } from "@/lib/format"
import { ServiceRecordForm } from "@/components/service/service-record-form"
import type { Asset } from "@/lib/types"

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: assets }, { data: records }, { data: profile }] = await Promise.all([
    supabase.from("assets").select("id, product_name").eq("owner_id", user.id).eq("status", "active").order("product_name"),
    supabase
      .from("service_records")
      .select("id, title, notes, cost, performed_by, serviced_at, asset_id, assets ( product_name )")
      .eq("owner_id", user.id)
      .order("serviced_at", { ascending: false }),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ])

  const assetOptions = (assets as Pick<Asset, "id" | "product_name">[]) || []

  return (
    <AppShell active="Service" userName={profile?.full_name || undefined} userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Service History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every repair, checkup, and part swap across your assets.</p>
        </div>

        {assetOptions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Add an asset first, then log its service history here.</p>
            <Link href="/create" className="mt-4 inline-block text-sm font-medium text-brand">
              Create your first passport →
            </Link>
          </div>
        ) : (
          <>
            <ServiceRecordForm assets={assetOptions} />

            <div className="mt-6 space-y-2">
              {(!records || records.length === 0) && (
                <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  No service records logged yet.
                </div>
              )}
              {(records as any[])?.map((r) => (
                <Link
                  key={r.id}
                  href={`/passport/${r.asset_id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/40"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Wrench className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {r.title} <span className="font-normal text-muted-foreground">· {r.assets?.product_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.serviced_at)} {r.cost ? `· ${formatINR(r.cost)}` : ""}
                      {r.performed_by ? ` · by ${r.performed_by}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
