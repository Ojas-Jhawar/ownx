import { redirect } from "next/navigation"
import Link from "next/link"
import { Factory, Plus, ArrowRight, CheckCircle2 } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { createClient } from "@/lib/supabase/server"
import { createDevice } from "@/app/actions/devices"

export default async function Page({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, organizations ( id, name, org_type )")
    .eq("user_id", user.id)

  const org = (memberships as any[] | null)?.map((m) => m.organizations).find((o: any) => o?.org_type === "manufacturer")
  if (!org) redirect("/organization")

  const { data: devices } = await supabase
    .from("devices")
    .select("id, ownx_id, product_name, brand, category, status, created_at")
    .eq("manufacturer_org_id", org.id)
    .order("created_at", { ascending: false })

  return (
    <AppShell active="Business" userEmail={user.email}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <Factory className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{org.name}</h1>
            <p className="text-sm text-muted-foreground">Manufacturer dashboard</p>
          </div>
        </div>

        {created && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft/60 p-4 text-sm text-ink">
            <CheckCircle2 className="size-4 text-brand" /> Device registered — Ownx ID{" "}
            <span className="font-mono font-semibold">{created}</span>
          </div>
        )}

        <details className="mt-6 rounded-2xl border border-border bg-card p-5" open={!devices || devices.length === 0}>
          <summary className="cursor-pointer font-semibold text-ink">Register a new device</summary>
          <form action={createDevice} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="product_name" label="Product name" required />
            <Field name="brand" label="Brand" />
            <Field name="category" label="Category" placeholder="Laptop, Phone, Headphones…" />
            <Field name="model_number" label="Model number" />
            <Field name="serial_number" label="Serial number" />
            <Field name="imei" label="IMEI (if applicable)" />
            <Field name="manufactured_at" label="Manufactured on" type="date" />
            <Field name="warranty_months" label="Warranty (months)" type="number" />
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Authenticity notes</label>
              <textarea
                name="authenticity_notes"
                rows={2}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5 sm:col-span-2"
            >
              <Plus className="size-4" /> Generate Ownx Passport
            </button>
          </form>
        </details>

        <div className="mt-6 space-y-2">
          {(devices || []).map((d) => (
            <Link
              key={d.id}
              href={`/device/${d.ownx_id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{d.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{d.ownx_id}</span> · {[d.brand, d.category].filter(Boolean).join(" · ")} ·{" "}
                  <span className="capitalize">{d.status}</span>
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          {(!devices || devices.length === 0) && (
            <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No devices registered yet.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  )
}