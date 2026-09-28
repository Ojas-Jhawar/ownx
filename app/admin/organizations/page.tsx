import { redirect } from "next/navigation"
import { Building2, Factory, Store, Wrench, ExternalLink, PauseCircle, PlayCircle } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { CreateOrgForm } from "@/components/admin/create-org-form"
import { createClient } from "@/lib/supabase/server"
import { setOrganizationVerified } from "@/app/actions/organizations"
import { formatDate } from "@/lib/format"

const ORG_ICON: Record<string, typeof Factory> = {
  manufacturer: Factory,
  seller: Store,
  repair_shop: Wrench,
  admin: Building2,
}

// Admin-only. RLS (migration 010) is the real gate; this redirect just avoids
// showing a broken page to non-admins.
export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
  if (profile?.platform_role !== "admin") redirect("/dashboard")

  const { data: orgsRaw } = await supabase
    .from("organizations")
    .select("id, name, org_type, verified, registration_number, contact_email, onboarding_notes, created_at")
    .order("created_at", { ascending: false })
  const orgs = orgsRaw || []

  // Owner emails: two queries because organization_members references
  // auth.users, not profiles, so a PostgREST embed isn't available.
  const orgIds = orgs.map((o) => o.id)
  const { data: members } = orgIds.length
    ? await supabase.from("organization_members").select("organization_id, user_id, role").in("organization_id", orgIds)
    : { data: [] as { organization_id: string; user_id: string; role: string }[] }
  const userIds = Array.from(new Set((members || []).map((m) => m.user_id)))
  const { data: ownerProfiles } = userIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] }
  const profileById = new Map((ownerProfiles || []).map((p) => [p.id, p]))
  const ownerByOrg = new Map<string, string>()
  for (const m of members || []) {
    if (m.role === "owner") {
      const p = profileById.get(m.user_id)
      ownerByOrg.set(m.organization_id, p?.email || p?.full_name || "Unknown")
    }
  }

  const formUrl = process.env.NEXT_PUBLIC_ORG_FORM_URL
  const responsesUrl = process.env.NEXT_PUBLIC_ORG_FORM_RESPONSES_URL

  return (
    <AppShell active="Admin" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Organisations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Businesses apply through the Google Form. Verify them first, then create the organisation here. The owner
            gets an email invite and sets their own password.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {responsesUrl && (
              
                href={responsesUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
              >
                Open form responses <ExternalLink className="size-3.5" />
              </a>
            )}
            {formUrl && (
              
                href={formUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
              >
                View public form <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>

        <details className="mt-6 rounded-2xl border border-border bg-card p-5" open>
          <summary className="cursor-pointer font-semibold text-ink">Create organisation for a verified business</summary>
          <CreateOrgForm />
        </details>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">All organisations ({orgs.length})</h2>
          {orgs.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No organisations yet.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {orgs.map((org) => {
                const Icon = ORG_ICON[org.org_type] || Building2
                const toggle = setOrganizationVerified.bind(null, org.id, !org.verified)
                return (
                  <div key={org.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          org.verified
                            ? "grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"
                            : "grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600"
                        }
                      >
                        <Icon className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{org.name}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {org.org_type.replace("_", " ")} · {org.verified ? "Verified" : "Suspended"} · created{" "}
                          {formatDate(org.created_at)}
                        </p>
                      </div>
                      <form action={toggle}>
                        <button
                          type="submit"
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted"
                        >
                          {org.verified ? (
                            <>
                              <PauseCircle className="size-3.5" /> Suspend
                            </>
                          ) : (
                            <>
                              <PlayCircle className="size-3.5" /> Reinstate
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                    <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        Owner: <span className="text-ink">{ownerByOrg.get(org.id) || "—"}</span>
                      </div>
                      <div>
                        Reg. no: <span className="font-mono text-ink">{org.registration_number || "—"}</span>
                      </div>
                      {org.onboarding_notes && (
                        <div className="sm:col-span-2">
                          Notes: <span className="text-ink">{org.onboarding_notes}</span>
                        </div>
                      )}
                    </dl>
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
