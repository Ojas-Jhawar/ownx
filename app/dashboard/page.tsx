import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { Package, ShieldCheck, Wrench, Wallet, Plus, ArrowRight } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { formatINR, warrantyRemaining } from "@/lib/format"
import type { Asset } from "@/lib/types"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profile }, { data: assetsRaw }, { data: serviceRecords }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("assets").select("*").eq("owner_id", user.id).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("service_records").select("asset_id").eq("owner_id", user.id),
  ])

  const assets = (assetsRaw || []) as Asset[]
  const servicedAssetIds = new Set((serviceRecords || []).map((r) => r.asset_id))

  const underWarranty = assets.filter((a) => warrantyRemaining(a.purchase_date, a.warranty_months).active)
  const neverServiced = assets.filter((a) => !servicedAssetIds.has(a.id))
  const totalValue = assets.reduce((sum, a) => sum + (a.purchase_price || 0), 0)

  const visibleAssets = filter === "warranty" ? underWarranty : assets

  const firstName = (profile?.full_name || user.email || "there").split(" ")[0]

  const STATS = [
    { icon: Package, label: "Assets", value: String(assets.length) },
    { icon: ShieldCheck, label: "Under warranty", value: String(underWarranty.length) },
    { icon: Wrench, label: "Never serviced", value: String(neverServiced.length) },
    { icon: Wallet, label: "Estimated value", value: formatINR(totalValue) },
  ]

  return (
    <AppShell active="Overview" userName={profile?.full_name || undefined} userEmail={user.email}>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Good day, {firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your assets.</p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground"
          >
            <Plus className="size-4" /> New Passport
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                <s.icon className="size-4.5" />
              </span>
              <p className="mt-3 text-2xl font-semibold text-ink">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-semibold text-ink">{filter === "warranty" ? "Under Warranty" : "Your Assets"}</h2>
          {filter === "warranty" && (
            <Link href="/dashboard" className="text-sm font-medium text-brand">
              Show all
            </Link>
          )}
        </div>

        {visibleAssets.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {filter === "warranty" ? "No assets currently under warranty." : "You haven't added any assets yet."}
            </p>
            {filter !== "warranty" && (
              <Link href="/create" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                Add your first asset <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAssets.map((a) => {
              const warranty = warrantyRemaining(a.purchase_date, a.warranty_months)
              return (
                <div key={a.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="relative aspect-[4/3] bg-muted">
                    <Image
                      src={a.image_url || "/images/product-laptop.png"}
                      alt={a.product_name || "Asset"}
                      fill
                      className="object-contain p-5"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-ink">{a.product_name || "Untitled asset"}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{warranty.label}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
                      <ShieldCheck className="size-3.5" /> Verified
                    </p>
                    <Link
                      href={`/passport/${a.id}`}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
                    >
                      View Passport <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
