import { redirect } from "next/navigation"
import { Building2, CheckCircle2, Clock, Factory, Store, Wrench } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { approveOrganization } from "@/app/actions/organizations"

const ORG_ICON: Record<string, typeof Factory> = {
  manufacturer: Factory,
  seller: Store,
  repair_shop: Wrench,
  admin: Building2,
}

// Admin-only. RLS ("Admins can approve organizations") already stops a
// non-admin from actually flipping verified = true, and approveOrganization()
// re-checks platform_role itself — this page-level check is just so a
// non-admin gets redirected instead of seeing a broken/empty screen.
export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") redirect("/organization")

  const { data: orgsRaw } = await supabase
    .from("organizations")
    .select("id, name, org_type, verified, created_at")
    .order("verified", { ascending: true })
    .order("created_at", { ascending: false })

  const orgs = orgsRaw || []
  const pending = orgs.filter((o) => !o.verified)
  const verified = orgs.filter((o) => o.verified)

  return (
    <AppShell active="Business" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Organization approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only verified organizations can register devices, record sales, or sign repairs — this is what makes the
            &ldquo;Verified&rdquo; badge on a passport actually mean something.
          </p>
        </div>

        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Clock className="size-4 text-amber-600" /> Pending verification ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nothing waiting for review.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {pending.map((org) => {
                const Icon = ORG_ICON[org.org_type] || Building2
                const boundApprove = approveOrganization.bind(null, org.id)
                return (
                  <div key={org.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{org.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{org.org_type.replace("_", " ")}</p>
                    </div>
                    <form action={boundApprove}>
                      <button
                        type="submit"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-medium text-brand-foreground"
                      >
                        <CheckCircle2 className="size-3.5" /> Approve
                      </button>
                    </form>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">Verified organizations ({verified.length})</h2>
          {verified.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No organizations verified yet.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {verified.map((org) => {
                const Icon = ORG_ICON[org.org_type] || Building2
                return (
                  <div key={org.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{org.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{org.org_type.replace("_", " ")}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-brand">Verified</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
