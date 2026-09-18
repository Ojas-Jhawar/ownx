import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ShieldCheck, Factory } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"

const STATUS_LABEL: Record<string, string> = {
  reported: "Reported",
  documented: "Documented",
  verified: "Verified",
  confirmed: "Confirmed",
}
const STATUS_TONE: Record<string, string> = {
  reported: "bg-muted text-muted-foreground",
  documented: "bg-amber-500/10 text-amber-600",
  verified: "bg-brand-soft text-brand",
  confirmed: "bg-emerald-500/10 text-emerald-600",
}

export default async function Page({ params }: { params: Promise<{ ownxId: string }> }) {
  const { ownxId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: device } = await supabase
    .from("devices")
    .select("*, organizations:manufacturer_org_id ( name )")
    .eq("ownx_id", ownxId.toUpperCase())
    .maybeSingle()

  if (!device) notFound()

  const { data: events } = await supabase
    .from("lifecycle_events")
    .select("*, organizations:actor_org_id ( name )")
    .eq("device_id", device.id)
    .order("created_at", { ascending: false })

  return (
    <AppShell active="Business" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-3xl border border-border bg-ink p-6 text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-white/50">Ownx Passport</span>
            <ShieldCheck className="size-5 text-brand" />
          </div>
          <p className="mt-3 text-lg font-semibold">{device.product_name}</p>
          <p className="text-sm text-white/60">{[device.brand, device.category].filter(Boolean).join(" · ") || "—"}</p>
          <p className="mt-3 font-mono text-sm text-brand">{device.ownx_id}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <Factory className="size-3.5" /> {device.organizations?.name || "Unknown manufacturer"}
            </span>
            <span className="capitalize">Status: {device.status}</span>
            {device.warranty_months && <span>{device.warranty_months} month warranty</span>}
          </div>
        </div>

        {device.asset_id && (
          <p className="mt-3 text-sm text-muted-foreground">
            <Link href={`/passport/${device.asset_id}`} className="font-medium text-brand hover:underline">
              View the owner&apos;s full passport →
            </Link>
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold text-ink">Lifecycle timeline</h2>
          <div className="mt-4 space-y-3">
            {(events || []).map((e: any) => (
              <div key={e.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{e.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_TONE[e.status]}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </div>
                {e.detail && <p className="mt-1 text-sm text-muted-foreground">{e.detail}</p>}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatDate(e.created_at)} {e.organizations?.name ? `· ${e.organizations.name}` : ""}
                </p>
              </div>
            ))}
            {(!events || events.length === 0) && <p className="text-sm text-muted-foreground">No events recorded yet.</p>}
          </div>
        </div>
      </div>
    </AppShell>
  )
}