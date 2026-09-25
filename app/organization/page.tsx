import { redirect } from "next/navigation"
import Link from "next/link"
import { Factory, Store, Wrench, ArrowRight, Building2, Clock } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { createOrganization } from "@/app/actions/organizations"

const ORG_TYPES = [
  { value: "manufacturer", label: "Manufacturer", icon: Factory, copy: "Register devices and issue permanent Ownx Passports.", href: "/manufacturer" },
  { value: "seller", label: "Seller / Retailer", icon: Store, copy: "Record sales and hand off passports to buyers.", href: "/seller" },
  { value: "repair_shop", label: "Repair Shop", icon: Wrench, copy: "Look up any device and log verified repairs.", href: "/repair" },
] as const

export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organizations ( id, name, org_type, verified )")
    .eq("user_id", user.id)

  const myOrgs = (memberships as any[])?.map((m) => m.organizations).filter(Boolean) || []

  return (
    <AppShell active="Business" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Business Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manufacturers, sellers and repair shops all plug into the same Ownx Passport network.
          </p>
        </div>

        {created && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-ink">Organization created — pending verification</p>
              <p className="mt-0.5 text-muted-foreground">
                An Ownx admin reviews every new business account before it can register devices, record sales, or
                sign repairs. You can explore the dashboard now; those actions unlock once you&apos;re approved.
              </p>
            </div>
          </div>
        )}

        {myOrgs.length > 0 && (
          <div className="mt-6 space-y-3">
            {myOrgs.map((org: any) => {
              const meta = ORG_TYPES.find((t) => t.value === org.org_type)
              return (
                <Link
                  key={org.id}
                  href={meta?.href || "/organization"}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/40"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    {meta ? <meta.icon className="size-5" /> : <Building2 className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{org.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {org.org_type.replace("_", " ")} ·{" "}
                      {org.verified ? (
                        <span className="text-brand">Verified</span>
                      ) : (
                        <span className="text-amber-600">Pending verification</span>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6">
          <h2 className="font-semibold text-ink">Register a new organization</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New organizations start <span className="font-medium text-ink">pending verification</span>. An Ownx
            admin reviews and approves before you can register devices, record sales, or sign repairs — this is what
            makes the &ldquo;Verified&rdquo; badge on a passport actually mean something.
          </p>
          <form action={createOrganization} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              name="name"
              required
              placeholder="Organization name, e.g. Acme Electronics"
              className="rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <select
              name="org_type"
              required
              defaultValue=""
              className="rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="" disabled>
                Choose type…
              </option>
              {ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5 sm:col-span-2"
            >
              Create organization
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {ORG_TYPES.map((t) => (
            <div key={t.value} className="rounded-2xl border border-border bg-card p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <t.icon className="size-4.5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{t.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
